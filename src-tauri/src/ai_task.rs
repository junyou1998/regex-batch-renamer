use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio::sync::oneshot;

static TASKS: OnceLock<Mutex<HashMap<String, oneshot::Sender<()>>>> = OnceLock::new();

fn get_tasks() -> &'static Mutex<HashMap<String, oneshot::Sender<()>>> {
    TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register_task(task_id: &str) -> oneshot::Receiver<()> {
    let (tx, rx) = oneshot::channel();
    if let Ok(mut map) = get_tasks().lock() {
        map.insert(task_id.to_string(), tx);
    }
    rx
}

pub fn finish_task(task_id: &str) {
    if let Ok(mut map) = get_tasks().lock() {
        map.remove(task_id);
    }
}

pub fn cancel_task(task_id: &str) -> bool {
    if let Ok(mut map) = get_tasks().lock() {
        if let Some(tx) = map.remove(task_id) {
            let _ = tx.send(());
            return true;
        }
    }
    false
}
