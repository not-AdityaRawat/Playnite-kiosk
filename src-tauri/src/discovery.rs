use std::fs;
use std::path::{Path, PathBuf};

use crate::models::{DiscoveryCandidate, GameInput};

pub fn discover_local_games() -> Vec<DiscoveryCandidate> {
    let mut candidates = discover_steam();
    candidates.extend(discover_epic());
    candidates.sort_by(|left, right| left.game.name.to_lowercase().cmp(&right.game.name.to_lowercase()));
    candidates
}

fn discover_steam() -> Vec<DiscoveryCandidate> {
    steam_roots().into_iter().flat_map(|root| steam_library_paths(&root)).flat_map(|library| {
        let manifests = library.join("steamapps");
        fs::read_dir(manifests).into_iter().flatten().flatten().filter_map(|entry| {
            let path = entry.path();
            let file_name = path.file_name()?.to_str()?;
            if !file_name.starts_with("appmanifest_") || path.extension().and_then(|extension| extension.to_str()) != Some("acf") { return None; }
            let contents = fs::read_to_string(&path).ok()?;
            let app_id = vdf_value(&contents, "appid")?;
            let name = vdf_value(&contents, "name")?;
            let install_dir = vdf_value(&contents, "installdir").map(|directory| library.join("steamapps").join("common").join(directory));
            let process_name = install_dir.as_deref().and_then(find_executable_name);
            Some(DiscoveryCandidate {
                source: "Steam".into(),
                game: GameInput {
                    id: None, name, launch_method: "steam_uri".into(), executable: format!("steam://rungameid/{app_id}"),
                    working_directory: None, arguments: None, icon_path: None, process_name, accent: "#75d7cb".into(), sort_order: 0, visible: true,
                },
            })
        }).collect::<Vec<_>>()
    }).collect()
}

fn discover_epic() -> Vec<DiscoveryCandidate> {
    let Some(program_data) = std::env::var_os("PROGRAMDATA") else { return Vec::new(); };
    let manifest_dir = PathBuf::from(program_data).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests");
    fs::read_dir(manifest_dir).into_iter().flatten().flatten().filter_map(|entry| {
        let contents = fs::read_to_string(entry.path()).ok()?;
        let manifest: serde_json::Value = serde_json::from_str(&contents).ok()?;
        let name = manifest.get("DisplayName")?.as_str()?.trim();
        let install_directory = manifest.get("InstallLocation")?.as_str()?;
        let launch_executable = manifest.get("LaunchExecutable")?.as_str()?;
        let target = Path::new(launch_executable);
        let executable = if target.is_absolute() { target.to_path_buf() } else { PathBuf::from(install_directory).join(target) };
        let process_name = executable.file_name().and_then(|file_name| file_name.to_str()).map(str::to_string);
        Some(DiscoveryCandidate {
            source: "Epic Games".into(),
            game: GameInput {
                id: None, name: name.into(), launch_method: "direct_exe".into(), executable: executable.to_string_lossy().into_owned(),
                working_directory: Some(install_directory.into()), arguments: manifest.get("LaunchCommand").and_then(|value| value.as_str()).map(str::to_string),
                icon_path: None, process_name, accent: "#75d7cb".into(), sort_order: 0, visible: true,
            },
        })
    }).collect()
}

fn steam_roots() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from(r"C:\Program Files (x86)\Steam"), PathBuf::from(r"C:\Program Files\Steam")];
    for variable in ["PROGRAMFILES(X86)", "PROGRAMFILES"] {
        if let Some(directory) = std::env::var_os(variable) { roots.push(PathBuf::from(directory).join("Steam")); }
    }
    roots.sort();
    roots.dedup();
    roots.into_iter().filter(|root| root.exists()).collect()
}

fn steam_library_paths(root: &Path) -> Vec<PathBuf> {
    let mut paths = vec![root.to_path_buf()];
    let library_file = root.join("steamapps").join("libraryfolders.vdf");
    if let Ok(contents) = fs::read_to_string(library_file) {
        for line in contents.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with("\"path\"") { continue; }
            if let Some(path) = quoted_values(trimmed).nth(1) {
                paths.push(PathBuf::from(path.replace("\\\\", "\\")));
            }
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

fn vdf_value(contents: &str, key: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let values: Vec<_> = quoted_values(line).collect();
        (values.first().copied() == Some(key)).then(|| values.get(1).map(|value| value.replace("\\\\", "\\"))).flatten()
    })
}

fn quoted_values(line: &str) -> impl Iterator<Item = &str> {
    line.split('"').enumerate().filter_map(|(index, value)| (index % 2 == 1).then_some(value))
}

fn find_executable_name(directory: &Path) -> Option<String> {
    fs::read_dir(directory).ok()?.flatten().find_map(|entry| {
        let path = entry.path();
        (path.extension().and_then(|extension| extension.to_str()).is_some_and(|extension| extension.eq_ignore_ascii_case("exe")))
            .then(|| path.file_name().and_then(|file_name| file_name.to_str()).map(str::to_string))
            .flatten()
    })
}

#[cfg(test)]
mod tests {
    use super::vdf_value;

    #[test]
    fn reads_steam_manifest_values_without_network_metadata() {
        let manifest = "\"appid\"\t\t\"1245620\"\n\"name\"\t\t\"Elden Ring\"\n\"installdir\"\t\t\"ELDEN RING\"";
        assert_eq!(vdf_value(manifest, "appid").as_deref(), Some("1245620"));
        assert_eq!(vdf_value(manifest, "name").as_deref(), Some("Elden Ring"));
    }
}
