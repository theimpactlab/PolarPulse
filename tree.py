from pathlib import Path
from typing import List, Optional, Union

def build_tree_lines(
    root: Union[str, Path],
    max_depth: Optional[int] = None,
    include_files: bool = True
) -> List[str]:
    root = Path(root).resolve()
    lines: List[str] = [root.name]

    def _walk(dir_path: Path, prefix: str, depth: int) -> None:
        if max_depth is not None and depth > max_depth:
            return

        children = [
            p for p in sorted(dir_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            if p.name not in {".git", "node_modules", "__pycache__", ".next", "dist", "build", "venv", ".venv"}
        ]

        if not include_files:
            children = [p for p in children if p.is_dir()]

        for i, child in enumerate(children):
            last = i == len(children) - 1
            connector = "└── " if last else "├── "
            lines.append(prefix + connector + child.name)

            if child.is_dir():
                extension = "    " if last else "│   "
                _walk(child, prefix + extension, depth + 1)

    lines[0] = str(root)
    _walk(root, "", 1)
    return lines

if __name__ == "__main__":
    lines = build_tree_lines(".", max_depth=None, include_files=True)
    Path("folder_structure.txt").write_text("\n".join(lines), encoding="utf-8")
    print("Wrote folder_structure.txt")