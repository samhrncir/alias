// Chromium-only parts of the File System Access API (WICG spec). The handle and
// writable-stream types themselves are already in lib.dom.

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FilePickerOptions {
  /** Chrome remembers the last folder per id. */
  id?: string
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle
  excludeAcceptAllOption?: boolean
}

interface OpenFilePickerOptions extends FilePickerOptions {
  multiple?: boolean
}

interface SaveFilePickerOptions extends FilePickerOptions {
  suggestedName?: string
}

interface Window {
  showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
}
