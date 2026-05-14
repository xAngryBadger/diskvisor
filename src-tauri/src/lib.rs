use serde::Serialize;
use std::path::PathBuf;
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
    children: Vec<FileNode>,
    modified: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    root: FileNode,
    total_size: u64,
    total_files: u64,
    total_dirs: u64,
    elapsed_ms: u64,
}

#[tauri::command]
async fn scan_directory(path: String, max_depth: Option<usize>) -> Result<ScanResult, String> {
    let max_depth = max_depth.unwrap_or(4);
    let start = SystemTime::now();
    let root_path = PathBuf::from(&path);

    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut total_files: u64 = 0;
        let mut total_dirs: u64 = 0;
        let root = scan_recursive(&root_path, max_depth, 0, &mut total_files, &mut total_dirs)?;
        Ok::<_, String>((root, total_files, total_dirs))
    })
    .await
    .map_err(|e| format!("scan task failed: {}", e))??;

    let elapsed = start
        .elapsed()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(ScanResult {
        total_size: result.0.size,
        root: result.0,
        total_files: result.1,
        total_dirs: result.2,
        elapsed_ms: elapsed,
    })
}

fn scan_recursive(
    dir: &PathBuf,
    max_depth: usize,
    current_depth: usize,
    total_files: &mut u64,
    total_dirs: &mut u64,
) -> Result<FileNode, String> {
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string_lossy().to_string());

    let modified = dir
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    if current_depth >= max_depth {
        let size = dir_size_fast(dir);
        return Ok(FileNode {
            name,
            path: dir.to_string_lossy().to_string(),
            size,
            is_dir: true,
            children: vec![],
            modified,
        });
    }

    let mut children: Vec<FileNode> = Vec::new();
    let mut dir_total: u64 = 0;

    let mut entries: Vec<_> = jwalk::WalkDir::new(dir)
        .max_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .collect();

    entries.sort_by(|a, b| {
        let a_size = a.metadata().map(|m| m.len()).unwrap_or(0);
        let b_size = b.metadata().map(|m| m.len()).unwrap_or(0);
        b_size.cmp(&a_size)
    });

    for entry in entries {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if metadata.is_dir() {
            *total_dirs += 1;
            match scan_recursive(
                &path.to_path_buf(),
                max_depth,
                current_depth + 1,
                total_files,
                total_dirs,
            ) {
                Ok(child) => {
                    dir_total += child.size;
                    children.push(child);
                }
                Err(_) => continue,
            }
        } else {
            *total_files += 1;
            let size = metadata.len();
            dir_total += size;
            let file_modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs());

            children.push(FileNode {
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                path: path.to_string_lossy().to_string(),
                size,
                is_dir: false,
                children: vec![],
                modified: file_modified,
            });
        }
    }

    children.sort_by(|a, b| b.size.cmp(&a.size));

    Ok(FileNode {
        name,
        path: dir.to_string_lossy().to_string(),
        size: dir_total,
        is_dir: true,
        children,
        modified,
    })
}

fn dir_size_fast(dir: &PathBuf) -> u64 {
    let mut total: u64 = 0;
    for entry in jwalk::WalkDir::new(dir).follow_links(false) {
        if let Ok(e) = entry {
            if let Ok(m) = e.metadata() {
                if m.is_file() {
                    total += m.len();
                }
            }
        }
    }
    total
}

#[tauri::command]
async fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Cannot determine home directory".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![scan_directory, get_home_dir])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
