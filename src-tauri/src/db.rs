use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub id: String,
    pub name: String,
    pub position: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Lane {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub position: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub lane_id: String,
    pub title: String,
    pub notes: String,
    pub due: Option<String>,
    pub label: Option<String>,
    pub position: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Default, Debug, PartialEq)]
#[serde(default)]
pub struct Rows {
    pub boards: Vec<Board>,
    pub lanes: Vec<Lane>,
    pub cards: Vec<Card>,
}

#[derive(Deserialize, Default, Debug)]
#[serde(default)]
pub struct Deletes {
    pub boards: Vec<String>,
    pub lanes: Vec<String>,
    pub cards: Vec<String>,
}

#[derive(Deserialize, Default, Debug)]
#[serde(default)]
pub struct Changes {
    pub upsert: Rows,
    pub delete: Deletes,
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // FULL: a committed change survives a crash or power loss, not only an app quit.
    conn.pragma_update(None, "synchronous", "FULL")?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "BEGIN;
             CREATE TABLE boards (id TEXT PRIMARY KEY, name TEXT NOT NULL, position REAL NOT NULL);
             CREATE TABLE lanes (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, name TEXT NOT NULL, position REAL NOT NULL);
             CREATE TABLE cards (
               id TEXT PRIMARY KEY, lane_id TEXT NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
               due TEXT, label TEXT, position REAL NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
             );
             CREATE INDEX lanes_board ON lanes(board_id);
             CREATE INDEX cards_lane ON cards(lane_id);
             PRAGMA user_version = 1;
             COMMIT;",
        )?;
    }
    Ok(())
}

pub fn load(conn: &Connection) -> rusqlite::Result<Rows> {
    let boards = conn
        .prepare("SELECT id, name, position FROM boards ORDER BY position")?
        .query_map([], |r| Ok(Board { id: r.get(0)?, name: r.get(1)?, position: r.get(2)? }))?
        .collect::<Result<_, _>>()?;
    let lanes = conn
        .prepare("SELECT id, board_id, name, position FROM lanes ORDER BY position")?
        .query_map([], |r| Ok(Lane { id: r.get(0)?, board_id: r.get(1)?, name: r.get(2)?, position: r.get(3)? }))?
        .collect::<Result<_, _>>()?;
    let cards = conn
        .prepare("SELECT id, lane_id, title, notes, due, label, position, created_at, updated_at FROM cards ORDER BY position")?
        .query_map([], |r| {
            Ok(Card {
                id: r.get(0)?,
                lane_id: r.get(1)?,
                title: r.get(2)?,
                notes: r.get(3)?,
                due: r.get(4)?,
                label: r.get(5)?,
                position: r.get(6)?,
                created_at: r.get(7)?,
                updated_at: r.get(8)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(Rows { boards, lanes, cards })
}

/// Apply one change set in a single transaction: all of it lands or none of it does.
pub fn apply(conn: &mut Connection, ch: &Changes) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    for id in &ch.delete.cards {
        tx.execute("DELETE FROM cards WHERE id = ?1", params![id])?;
    }
    for id in &ch.delete.lanes {
        tx.execute("DELETE FROM lanes WHERE id = ?1", params![id])?;
    }
    for id in &ch.delete.boards {
        tx.execute("DELETE FROM boards WHERE id = ?1", params![id])?;
    }
    for b in &ch.upsert.boards {
        tx.execute(
            "INSERT INTO boards (id, name, position) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, position = excluded.position",
            params![b.id, b.name, b.position],
        )?;
    }
    for l in &ch.upsert.lanes {
        tx.execute(
            "INSERT INTO lanes (id, board_id, name, position) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET board_id = excluded.board_id, name = excluded.name, position = excluded.position",
            params![l.id, l.board_id, l.name, l.position],
        )?;
    }
    for c in &ch.upsert.cards {
        tx.execute(
            "INSERT INTO cards (id, lane_id, title, notes, due, label, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET lane_id = excluded.lane_id, title = excluded.title, notes = excluded.notes,
               due = excluded.due, label = excluded.label, position = excluded.position, updated_at = excluded.updated_at",
            params![c.id, c.lane_id, c.title, c.notes, c.due, c.label, c.position, c.created_at, c.updated_at],
        )?;
    }
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        c
    }

    #[test]
    fn upsert_load_delete_round_trip() {
        let mut c = mem();
        let changes: Changes = serde_json::from_str(
            r#"{"upsert":{"boards":[{"id":"b","name":"Builds","position":1}],
                "lanes":[{"id":"l","boardId":"b","name":"Doing","position":1}],
                "cards":[{"id":"c","laneId":"l","title":"Ship","notes":"","due":"2026-11-24","label":"sun","position":1,"createdAt":1,"updatedAt":1}]},
               "delete":{"boards":[],"lanes":[],"cards":[]}}"#,
        )
        .unwrap();
        apply(&mut c, &changes).unwrap();
        let rows = load(&c).unwrap();
        assert_eq!(rows.cards[0].title, "Ship");
        assert_eq!(rows.cards[0].due.as_deref(), Some("2026-11-24"));
        assert_eq!(rows.lanes[0].board_id, "b");

        let rename: Changes = serde_json::from_str(
            r#"{"upsert":{"cards":[{"id":"c","laneId":"l","title":"Shipped","notes":"n","due":null,"label":null,"position":2,"createdAt":1,"updatedAt":2}]}}"#,
        )
        .unwrap();
        apply(&mut c, &rename).unwrap();
        let rows = load(&c).unwrap();
        assert_eq!(rows.cards.len(), 1);
        assert_eq!(rows.cards[0].title, "Shipped");
        assert_eq!(rows.cards[0].due, None);

        let del: Changes = serde_json::from_str(r#"{"delete":{"boards":["b"],"lanes":["l"],"cards":["c"]}}"#).unwrap();
        apply(&mut c, &del).unwrap();
        assert_eq!(load(&c).unwrap(), Rows::default());
    }

    #[test]
    fn migrate_is_idempotent() {
        let c = mem();
        migrate(&c).unwrap();
        let v: i64 = c.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        assert_eq!(v, 1);
    }
}
