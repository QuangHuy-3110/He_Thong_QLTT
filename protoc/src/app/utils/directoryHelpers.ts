import { Directory, LessonPlan } from './types';

// Count lessons in a directory and all its descendants (deduplicated)
export function countLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): number {
  return getLessonsInDir(dirId, directories, allLessons).length;
}

// Collect all lesson IDs in a directory and its descendants
export function getLessonsInDir(dirId: number, directories: Directory[], allLessons: LessonPlan[]): LessonPlan[] {
  const childIds = directories.filter(d => d.parent === dirId).map(d => d.id);
  const direct = allLessons.filter(l => l.directory_ids?.includes(dirId));
  const childLessons = childIds.flatMap(cid => getLessonsInDir(cid, directories, allLessons));
  // Deduplicate
  const seen = new Set<number>();
  return [...direct, ...childLessons].filter(l => { 
    if (seen.has(l.id)) return false; 
    seen.add(l.id); 
    return true; 
  });
}

// Get the full breadcrumb path of a directory (e.g., "Sinh học / Vi sinh vật")
export function getDirectoryFullPath(dirId: string | number, dirs: Directory[]): string {
  const path: string[] = [];
  let currentId: string | number | null = dirId;
  const visited = new Set<string | number>();

  while (currentId !== null && currentId !== undefined && currentId !== '') {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const found = dirs.find(d => d.id.toString() === currentId!.toString());
    if (found) {
      path.unshift(found.name);
      currentId = found.parent || null;
    } else {
      break;
    }
  }
  return path.join(' / ');
}

export interface DirectoryOption {
  id: number;
  name: string;
  is_public: boolean;
  depth: number;
  visualPrefix: string;
}

export const getDirectoriesAsTreeOptions = (
  dirs: Directory[],
  filterFn?: (d: Directory) => boolean
): DirectoryOption[] => {
  const baseDirs = filterFn ? dirs.filter(filterFn) : dirs;
  const childrenMap = new Map<number | null, Directory[]>();
  baseDirs.forEach(d => {
    const parentId = d.parent;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(d);
  });

  const result: DirectoryOption[] = [];

  const traverse = (parentId: number | null, depth: number, prefix: string) => {
    const children = childrenMap.get(parentId) || [];
    children.sort((a, b) => a.name.localeCompare(b.name));

    children.forEach((child, index) => {
      const isLast = index === children.length - 1;
      const currentPrefix = prefix + (isLast ? '└─ ' : '├─ ');
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');

      result.push({
        id: child.id,
        name: child.name,
        is_public: child.is_public,
        depth: depth,
        visualPrefix: currentPrefix
      });

      traverse(child.id, depth + 1, nextPrefix);
    });
  };

  const activeIds = new Set(baseDirs.map(d => d.id));
  const roots = baseDirs.filter(d => !d.parent || !activeIds.has(d.parent));
  roots.sort((a, b) => a.name.localeCompare(b.name));

  roots.forEach((root) => {
    result.push({
      id: root.id,
      name: root.name,
      is_public: root.is_public,
      depth: 0,
      visualPrefix: '📂 '
    });
    traverse(root.id, 1, '');
  });

  return result;
};

// Find the matching directory ID based on Mạch kiến thức (track) and Chủ đề (topic)
export function findMatchingDirId(track?: string, topic?: string, dirs?: Directory[]): number | null {
  if (!dirs || dirs.length === 0 || (!track && !topic)) return null;

  const cleanTrack = track ? track.trim().toLowerCase() : '';
  const cleanTopic = topic ? topic.trim().toLowerCase() : '';

  // 1. Find root dir matching track
  if (cleanTrack && cleanTopic) {
    const rootDir = dirs.find(d => (!d.parent || d.parent === null) && (d.name.trim().toLowerCase().includes(cleanTrack) || cleanTrack.includes(d.name.trim().toLowerCase())));
    if (rootDir) {
      const childDir = dirs.find(d => d.parent === rootDir.id && (d.name.trim().toLowerCase().includes(cleanTopic) || cleanTopic.includes(d.name.trim().toLowerCase())));
      if (childDir) return childDir.id;
      return rootDir.id;
    }
  }

  // 2. Find folder matching topic anywhere
  if (cleanTopic) {
    const matchedByTopic = dirs.find(d => d.name.trim().toLowerCase().includes(cleanTopic) || cleanTopic.includes(d.name.trim().toLowerCase()));
    if (matchedByTopic) return matchedByTopic.id;
  }

  // 3. Find folder matching track anywhere
  if (cleanTrack) {
    const matchedByTrack = dirs.find(d => d.name.trim().toLowerCase().includes(cleanTrack) || cleanTrack.includes(d.name.trim().toLowerCase()));
    if (matchedByTrack) return matchedByTrack.id;
  }

  return null;
}

// Derive Mạch kiến thức (track) and Chủ đề (topic) from selected directory ID
export function getTrackAndTopicFromDir(dirId: number | null, dirs: Directory[]): { track: string; topic: string } {
  if (!dirId || !dirs || dirs.length === 0) return { track: '', topic: '' };

  const current = dirs.find(d => d.id === dirId);
  if (!current) return { track: '', topic: '' };

  // Trace up to the top-most root directory (where parent is null)
  let rootDir = current;
  const visited = new Set<number>();
  while (rootDir.parent && !visited.has(rootDir.parent)) {
    visited.add(rootDir.id);
    const parentDir = dirs.find(d => d.id === rootDir.parent);
    if (parentDir) {
      rootDir = parentDir;
    } else {
      break;
    }
  }

  // Root directory name is the Mạch kiến thức (1 of the 4 root folders: bản thân, xã hội, tự nhiên, hướng nghiệp)
  const track = rootDir.name;
  const topic = current.id !== rootDir.id ? current.name : '';

  return { track, topic };
}

// Get array of directory ID and all its ancestor IDs (parent, grandparent...)
export function getDirectoryAncestorsAndSelf(dirId: number, dirs: Directory[]): number[] {
  const result: number[] = [];
  let currentId: number | null = dirId;
  const visited = new Set<number>();

  while (currentId !== null && currentId !== undefined) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    result.push(currentId);

    const found = dirs.find(d => d.id === currentId);
    currentId = found && found.parent ? found.parent : null;
  }
  return result;
}

export const getDescendantIds = (dirId: string | number, directories: Directory[]): string[] => {
  const result: string[] = [];
  const findChildren = (id: string | number) => {
    directories.forEach((d: Directory) => {
      if (d.parent !== null && d.parent.toString() === id.toString()) {
        result.push(d.id.toString());
        findChildren(d.id);
      }
    });
  };
  findChildren(dirId);
  return result;
};

// Recursive helper: collect all dir IDs a user can manage (by explicit grant + children)
export function getAllDescendantIds(dirId: number, directories: Directory[]): number[] {
  const children = directories.filter(d => d.parent === dirId);
  return [dirId, ...children.flatMap(c => getAllDescendantIds(c.id, directories))];
}
