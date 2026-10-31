import type { Folder } from '../types';
import { folderPath } from '../db';

interface Props {
  folders: Folder[];
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
}

export function FolderSelect({ folders, value, onChange, id }: Props) {
  const options = folders
    .map((f) => ({ id: f.id, path: folderPath(folders, f.id) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'));
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">미분류</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.path}
        </option>
      ))}
    </select>
  );
}
