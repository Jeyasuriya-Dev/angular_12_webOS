import { Component, Inject, Injectable, NgZone } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';

declare const tizen: any;
interface UsbInfo {
  totalPendrives: number;
  pendrivesWithIQ: string[];
}


@Injectable({
  providedIn: 'root',
})
export class FilesystemService {
  private activeDownloads = new Map<string, Promise<string>>();
  private dialogRef: MatDialogRef<InlineProgressDialogComponent> | null = null;
  constructor(private ngZone: NgZone, private dialog: MatDialog) { }
  private downloading$ = new BehaviorSubject<boolean>(false);
  private downloadProgress$ = new BehaviorSubject<number>(0);

  getDownloadingState() {
    return this.downloading$.asObservable();
  }

  getDownloadProgress() {
    return this.downloadProgress$.asObservable();
  }

  detectPlatform(): 'tizen' | 'webos' | 'browser' {
    const w = window as any;
    if (typeof w.PalmServiceBridge === 'function' || typeof w.PalmServiceBridge === 'object') return 'webos';
    if (w.tizen && typeof w.tizen.filesystem?.resolve === 'function') return 'tizen';
    return 'browser';
  }

  downloadFile(url: string, destinationDir: string, fileName?: string): Promise<string> {
    if (this.detectPlatform() === 'tizen') {
      // If already downloading this URL, return the same Promise
      const key = `${destinationDir}/${fileName || url.split('/').pop()}`;
      if (this.activeDownloads.has(key)) {
        console.log(`⏳ Download already in progress for: ${key}`);
        return this.activeDownloads.get(key)!;
      }

      // Create a new download Promise
      const downloadPromise = new Promise<string>((resolve) => {
        const finalFileName = fileName || url.split('/').pop();
        const fullPath = `${destinationDir}/${finalFileName}`;
        const MIN_FREE_SPACE = 300 * 1024 * 1024; // 300 MB buffer

        const startDownload = () => {
          try {
            const request = new tizen.DownloadRequest(url, destinationDir, finalFileName);
            const listener = {
              onprogress: (id: number, received: number, total: number) => {
                console.log(`Download progress: ${received}/${total}`);
                if (total > 0) {
                  const percent = Math.min(100, (received / total) * 100);
                  this.ngZone.run(() => {
                    this.downloadProgress$.next(percent);
                  });
                }
              },
              oncompleted: (id: number, path: string) => {
                console.log("Download completed:", path);
                this.activeDownloads.delete(key);
                this.ngZone.run(() => {
                  this.downloadProgress$.next(0);
                  this.downloading$.next(false);
                });
                resolve(path);
              },
              onfailed: (id: number, error: any) => {
                console.log("Download failed, returning original URL:", error.name, error.message);
                this.activeDownloads.delete(key);
                this.ngZone.run(() => {
                  this.downloadProgress$.next(0);
                  this.downloading$.next(false);
                });
                resolve(url);
              },
            };

            this.ngZone.run(() => {
              this.downloading$.next(true);
            });

            tizen.download.start(request, listener);
          } catch (error: any) {
            console.log("Failed to start download, returning original URL:", error.message);
            this.activeDownloads.delete(key);
            resolve(url);
          }
        };

        // Step 1: Check if file exists
        tizen.filesystem.resolve(
          fullPath,
          (file: any) => {
            console.log(`File exists at ${fullPath}, using cached file.`);
            this.activeDownloads.delete(key);
            this.ngZone.run(() => {
              this.downloadProgress$.next(0);
              this.downloading$.next(false);
            });
            resolve(file.toURI());
          },
          (error: any) => {
            if (error.name === "NotFoundError") {
              console.log(`No file at ${fullPath}, checking storage...`);
              checkStorageAndDownload();
            } else {
              console.log("Resolve failed, returning original URL:", error.message);
              this.activeDownloads.delete(key);
              resolve(url);
            }
          },
          "rw"
        );

        // Step 2: Check storage before downloading
        const checkStorageAndDownload = () => {
          tizen.systeminfo.getPropertyValue("STORAGE", (storages: any) => {
            const storage = storages.units?.find((u: any) => u.type === "INTERNAL") || storages.units?.[0];
            if (!storage) {
              console.log("⚠️ No storage found, returning original URL.");
              this.activeDownloads.delete(key);
              resolve(url);
              return;
            }

            const available = storage.availableCapacity;

            fetch(url, { method: "HEAD" })
              .then(res => {
                const totalSize = parseInt(res.headers.get("content-length") || "0", 10);

                if (totalSize > 0 && totalSize + MIN_FREE_SPACE > available) {
                  console.log("Not enough storage, returning original URL.");
                  this.activeDownloads.delete(key);
                  resolve(url);
                } else if (totalSize === 0 && available < MIN_FREE_SPACE) {
                  console.log("Low storage, returning original URL.");
                  this.activeDownloads.delete(key);
                  resolve(url);
                } else {
                  console.log(`Enough storage (${available} bytes free), starting download...`);
                  startDownload();
                }
              })
              .catch(() => {
                if (available < MIN_FREE_SPACE) {
                  console.log("Low storage (HEAD failed), returning original URL.");
                  this.activeDownloads.delete(key);
                  resolve(url);
                } else {
                  console.log("Could not fetch content-length, starting download anyway.");
                  startDownload();
                }
              });
          });
        };
      });

      // Cache active promise so duplicate calls reuse it
      this.activeDownloads.set(key, downloadPromise);
      return downloadPromise;
    } else {
      return Promise.resolve(url);
    }
  }



  deleteFile(fileUrl: string): Promise<void> {

    return new Promise<void>((resolve, reject) => {
      if (this.detectPlatform() !== 'tizen') {
        console.log('deleteFile called on non-Tizen platform:', fileUrl);
        resolve();
        return;
      }
      const tizenPath = fileUrl.replace(/^file:\/\//, '');
      tizen.filesystem.resolve(
        tizenPath,
        (file: any) => {
          if (file.isFile) {
            tizen.filesystem.deleteFile(
              file.toURI(),
              () => {
                console.log('File deleted:', tizenPath);
                resolve();
              },
              (error: any) => {
                console.error('Failed to delete file:', tizenPath, error);
                reject(error);
              }
            );
          } else {
            console.log('Not a file:', fileUrl);
            resolve();
          }
        },
        (error: any) => {
          console.error('Resolve failed:', fileUrl, error);
          reject(error);
        },
        'rw'
      );
    });

  }
  deleteAllFilesWithFolder(virtualRoot: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.detectPlatform() !== 'tizen') {
        console.log('deleteFiles called on non-Tizen platform:', virtualRoot);
        resolve();
        return;
      }
      tizen.filesystem.resolve(
        virtualRoot,
        (directory: any) => {
          directory.listFiles(
            (files: any[]) => {
              if (!files.length) {
                console.log('No files to delete.');
                resolve();
                return;
              }

              let pending = files.length;
              files.forEach((file) => {
                const done = () => {
                  pending--;
                  if (pending === 0) {
                    console.log('All files deleted');
                    resolve();
                  }
                };

                if (!file.isDirectory) {
                  tizen.filesystem.deleteFile(file.toURI(), done, (error: any) => reject(error));
                } else {
                  tizen.filesystem.deleteDirectory(file.toURI(), true, done, (error: any) => reject(error));
                }
              });
            },
            (error: any) => reject(error)
          );
        },
        (error: any) => reject(error),
        'rw'
      );
    });
  }

  //  Delete all files inside a virtual root

  deleteAllFiles(virtualRoot: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.detectPlatform() !== 'tizen') {
        console.log('deleteFiles called on non-Tizen platform:', virtualRoot);
        resolve();
        return;
      }
      tizen.filesystem.resolve(
        virtualRoot,
        (directory: any) => {
          directory.listFiles(
            (files: any[]) => {
              if (!files.length) {
                console.log('No files to delete.');
                resolve();
                return;
              }

              let pending = files.length;
              files.forEach((file) => {
                if (!file.isDirectory) {
                  tizen.filesystem.deleteFile(
                    file.toURI(),
                    () => {
                      pending--;
                      if (pending === 0) {
                        console.log('All files deleted');
                        resolve();
                      }
                    },
                    (error: any) => reject(error)
                  );
                } else {
                  pending--;
                }
              });
            },
            (error: any) => reject(error)
          );
        },
        (error: any) => reject(error),
        'rw'
      );
    });
  }


  getStorageInfo(): Promise<{
    total: number; used: number; remaining: number;
    totalMB: string; usedMB: string; remainingMB: string;
    totalGB: string; usedGB: string; remainingGB: string;
  }> {
    if (this.detectPlatform() !== 'tizen') {
      return Promise.reject(new Error('Platform is not Tizen'));
    }
    return new Promise((resolve, reject) => {
      try {
        this.detectPlatform()
        tizen.systeminfo.getPropertyValue("STORAGE", (storage: any) => {
          const internal = storage.units?.find((u: any) => u.type === "INTERNAL") || storage.units?.[0];

          if (!internal) {
            reject(new Error("No storage info available"));
            return;
          }

          const total = internal.capacity;
          const available = internal.availableCapacity;
          const used = total - available;

          // helpers
          const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
          const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

          resolve({
            total,
            used,
            remaining: available,
            totalMB: `${toMB(total)} MB`,
            usedMB: `${toMB(used)} MB`,
            remainingMB: `${toMB(available)} MB`,
            totalGB: `${toGB(total)} GB`,
            usedGB: `${toGB(used)} GB`,
            remainingGB: `${toGB(available)} GB`,
          });
        }, (err: any) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
  getStorages(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.detectPlatform() !== 'tizen') {
        console.log("Platform is not Tizen");

        return;
      }

      try {
        tizen.filesystem.listStorages(
          (storages: any) => {
            const storageObj = {
              internal: storages.filter((s: any) => s.type === 'INTERNAL' && s.state === 'MOUNTED'),
              external: storages.filter((s: any) => s.type === 'EXTERNAL' && s.state === 'MOUNTED')
            };

            resolve(storageObj);
          },
          (error: any) => {
            console.error('Error listing storages:', error.message);
            reject('Error listing storages: ' + error.message);
          }
        );
      } catch (e: any) {
        console.error('Exception while listing storages:', e);
        reject(e);
      }
    });
  }
  listAllFilesOnStorage(storageLabel: string, directoryPath: string = ''): Promise<Array<{ name: string; downloadedUrl: string; Url: string, id: number }>> {
    if (this.detectPlatform() !== 'tizen') {
      console.log('Filesystem access is only available on the Tizen platform.');
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      // Step 1: Resolve the storage using its virtual root name
      tizen.filesystem.resolve(
        storageLabel,
        (storageDir: any) => {
          // console.log(`Resolved storage label '${storageLabel}' to path: ${storageDir.fullPath}`);

          // Determine the target directory to list based on whether a directoryPath was provided
          const targetDir = directoryPath ? `${storageDir.fullPath}/${directoryPath}` : storageDir.fullPath;

          // Step 2: Resolve the final target directory
          tizen.filesystem.resolve(
            targetDir,
            (directory: any) => {
              // Step 3: List files in the target directory
              directory.listFiles(
                (files: any[]) => {
                  const fileList = files
                    .filter((file) => !file.isDirectory).sort((a, b) =>
                      a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: 'base'
                      })
                    )
                    .map((file, index) => ({
                      name: file.name,
                      downloadedUrl: file.toURI(),
                      Url: file.toURI(),
                      id: index,
                    }));
                  resolve(fileList);
                },
                (error: any) => {
                  console.error('Error listing directory files:', error.message);
                  reject(error);
                }
              );
            },
            (error: any) => {
              console.error(`Error resolving target path '${targetDir}':`, error.message);
              reject(error);
            },
            'r' // Read-only mode
          );
        },
        (error: any) => {
          console.error(`Error resolving storage label '${storageLabel}':`, error.message);
          // sessionStorage.setItem("ModeConfiguration", "false")
          reject(error);
        },
        'r' // Read-only mode
      );
    });
  }
  countPendrivesWithIQFolder(folderName: string = "IQ"): Promise<UsbInfo> {
    if (this.detectPlatform() !== 'tizen') {
      console.log('Filesystem access is only available on the Tizen platform.');
      return Promise.resolve({ totalPendrives: 0, pendrivesWithIQ: [] });
    }

    return new Promise((resolve, reject) => {
      tizen.filesystem.listStorages(
        async (storages: any[]) => {
          this.ngZone.run(async () => {
            const usbDrives = storages.filter(
              (s) => s.type === 'EXTERNAL' && s.state === 'MOUNTED'
            );

            const pendrivesWithIQ: string[] = [];

            // Use Promise.all to check all drives concurrently
            const checks = usbDrives.map(async (drive) => {
              const hasFolder = await this.checkFolderExists(drive.label, folderName);
              if (hasFolder) {
                pendrivesWithIQ.push(drive.label);
              }
            });

            await Promise.all(checks);

            const result: UsbInfo = {
              totalPendrives: usbDrives.length,
              pendrivesWithIQ: pendrivesWithIQ,
            };

            resolve(result);
          });
        },
        (error: any) => {
          console.error('Error listing storages:', error.message);
          this.ngZone.run(() => reject(error));
        }
      );
    });
  }
  private checkFolderExists(storageLabel: string, folderName: string): Promise<boolean> {
    return new Promise((resolve) => {
      tizen.filesystem.resolve(
        `${storageLabel}/${folderName}`,
        () => resolve(true),
        (error: any) => {
          if (error.name === 'NotFoundError') {
            resolve(false);
          } else {
            console.log(`Error resolving path '${storageLabel}/${folderName}':`, error.message);
            resolve(false);
          }
        },
        'r'
      );
    });
  }

  listAllSubfolders(path: string, recursive: boolean = true): Promise<string[]> {
    if (this.detectPlatform() !== 'tizen') {
      console.log('Filesystem access is only available on the Tizen platform.');
      return Promise.resolve([]);
    }

    return new Promise((resolve, reject) => {
      const allFolders: string[] = [];

      const listFoldersRecursive = (directory: any, callback: () => void) => {
        directory.listFiles(
          (files: any[]) => {
            const subdirectories = files.filter((f) => f.isDirectory);
            const remaining = subdirectories.length;

            if (remaining === 0) {
              callback();
              return;
            }

            let completed = 0;
            subdirectories.forEach((subdir) => {
              allFolders.push(subdir.fullPath);
              if (recursive) {
                listFoldersRecursive(subdir, () => {
                  completed++;
                  if (completed === remaining) {
                    callback();
                  }
                });
              } else {
                completed++;
                if (completed === remaining) {
                  callback();
                }
              }
            });
          },
          (error: any) => {
            console.error('Error listing directory:', error.message);
            callback();
          }
        );
      };

      tizen.filesystem.resolve(
        path,
        (dir: any) => {
          listFoldersRecursive(dir, () => {
            resolve(allFolders);
          });
        },
        (error: any) => {
          console.error('Error resolving filesystem:', error.message);
          reject(error);
        },
        'r' // Read mode
      );
    });
  }
  hasEnoughStorage(requiredMB: number = 300): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        tizen.systeminfo.getPropertyValue("STORAGE", (storages: any) => {
          const storage = storages.units?.find((u: any) => u.type === "INTERNAL") || storages.units?.[0];
          if (!storage) {
            console.log("No storage found.");
            resolve(false);
            return;
          }
          const availableMB = storage.availableCapacity / (1024 * 1024);
          resolve(availableMB >= requiredMB);
        }, (err: any) => {
          console.error("Error getting storage info:", err);
          resolve(false);
        });
      } catch (e) {
        console.error("Exception while checking storage:", e);
        resolve(false);
      }
    });
  }

  copyDirectory(sourceDir: string, destinationDir: string, overwrite: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.detectPlatform() !== 'tizen') {
        console.log('Filesystem access is only available on the Tizen platform.');
        return reject('Tizen filesystem API is not available.');
      }
      console.log("sourceDir : ", sourceDir);
      tizen.filesystem.copyDirectory(
        sourceDir,
        destinationDir,
        overwrite,
        () => {
          resolve();
        },
        (error: any) => {
          reject(error);
        }
      );
    });
  }
  async getStorageFullPath(storageLabel: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // console.log(`Step 1:Resolving storage: ${storageLabel}`);

      tizen.filesystem.resolve(
        storageLabel,
        (storageDir: any) => {
          const fullPath = storageDir.fullPath;
          // console.log(`Step 2: Storage resolved successfully`);
          // console.log(`Full path: ${fullPath}`);
          resolve(fullPath);
        },
        (error: any) => {
          console.error(`Failed to resolve storage '${storageLabel}'`);
          // console.error("Error details:", error);
          reject(error);
        }
      );
    });
  }
  copyFilesFromUSBToDownloads(files: any[], isClearCopyContent: boolean = false): void {
    const folderLabel = 'downloads'; // ✅ Correct Tizen alias (no full path)
    const folderName = 'IQW';

    const startCopy = (iqDestDir: any) => {
      this.dialogRef = this.dialog.open(InlineProgressDialogComponent, {
        data: { message: 'Starting copy...', indeterminate: true },
        disableClose: true,
        minWidth: '450px'
      });

      let copied = 0;

      files.forEach((file: any) => {
        const srcPath = file.downloadedUrl.replace('file://', '');
        const destPath = `${iqDestDir.fullPath}/${file.name}`;

        let exists = false;
        try {
          iqDestDir.resolve(file.name);
          exists = true;
        } catch {
          exists = false;
        }

        if (exists) {
          console.log(`Skipped (already exists): ${file.name}`);
          copied++;
          this.dialogRef!.componentInstance.data.message =
            `Skipped: ${file.name} (${copied}/${files.length})`;
        } else {
          tizen.filesystem.copyFile(
            srcPath,
            destPath,
            false,
            () => {
              copied++;
              console.log(`Copied: ${file.name} (${copied}/${files.length})`);
              this.dialogRef!.componentInstance.data.message =
                `Copied: ${file.name} (${copied}/${files.length})`;
              if (copied === files.length) {
                this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
                setTimeout(() => this.dialogRef?.close(), 2000);
              }
            },
            (err: any) => {
              copied++;
              console.error(`Failed: ${file.name}`, err.message);
              this.dialogRef!.componentInstance.data.message =
                `Failed: ${file.name} (${copied}/${files.length})`;
              if (copied === files.length) {
                this.dialogRef!.componentInstance.data.message = 'Copy process finished.';
                setTimeout(() => this.dialogRef?.close(), 2000);
              }
            }
          );
        }

        if (copied === files.length) {
          this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
          setTimeout(() => this.dialogRef?.close(), 2000);
        }
      });
    };

    const createFolder = () => {
      tizen.filesystem.resolve(
        folderLabel,
        (downloadsDir: any) => {
          let iqDestDir: any;
          try {
            iqDestDir = downloadsDir.resolve(folderName);
            console.log('IQW folder already exists.');
            startCopy(iqDestDir);
          } catch {
            iqDestDir = downloadsDir.createDirectory(folderName);
            console.log('IQW folder created.');
            startCopy(iqDestDir);
          }
        },
        (err: any) => {
          console.error('Error resolving Downloads folder:', err.message);
        },
        'rw'
      );
    };

    // ✅ Handle Clear Copy
    if (isClearCopyContent) {
      console.log('Clearing old content...');
      tizen.filesystem.resolve(
        folderLabel,
        (downloadsDir: any) => {
          downloadsDir.deleteDirectory(folderName, true,
            () => {
              console.log('Old folder deleted successfully.');
              setTimeout(createFolder, 500);
            },
            (error: any) => {
              if (error.name === 'NotFoundError') {
                console.log('Folder not found — will create new one.');
                createFolder();
              } else {
                console.error('Error deleting folder:', error.message);
                createFolder();
              }
            }
          );
        },
        (err: any) => {
          console.error('Error resolving downloads root for delete:', err.message);
          createFolder();
        },
        'rw'
      );
    } else {
      createFolder();
    }
  }

  copyFilesFromUSBToDownloads2(files: any[], isClearCopyContent: boolean): void {
    const folderPath = 'downloads/IQW';
    const parentPath = 'downloads';

    const startCopy = (iqDestDir: any) => {
      this.dialogRef = this.dialog.open(InlineProgressDialogComponent, {
        data: { message: 'Starting copy...', indeterminate: true },
        disableClose: true,
        minWidth: '450px'
      });

      let copied = 0;

      files.forEach((file: any, index: number) => {
        const srcPath = file.downloadedUrl.replace('file://', '');
        const destPath = `${iqDestDir.fullPath}/${file.name}`;

        // Check if file already exists
        let exists = false;
        try {
          iqDestDir.resolve(file.name);
          exists = true;
        } catch {
          exists = false;
        }

        if (exists) {
          console.log(`Skipped (already exists): ${file.name}`);
          copied++;
          this.dialogRef!.componentInstance.data.message =
            `Skipped: ${file.name} (${copied}/${files.length})`;
          if (copied == files.length) {
            this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
            setTimeout(() => this.dialogRef?.close(), 2000);
          }

        } else {
          // Copy file if it doesn't exist
          tizen.filesystem.copyFile(
            srcPath,
            destPath,
            false,
            () => {
              copied++;
              console.log(`Copied: ${file.name} (${copied}/${files.length})`);
              this.dialogRef!.componentInstance.data.message =
                `Copied: ${file.name} (${copied}/${files.length})`;
              if (copied == files.length) {
                this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
                setTimeout(() => this.dialogRef?.close(), 2000);
              }
            },
            (err: any) => {
              copied++;
              console.error(`Failed: ${file.name}`, err.message);
              this.dialogRef!.componentInstance.data.message =
                `Failed: ${file.name} (${copied}/${files.length})`;
              if (copied == files.length) {
                this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
                setTimeout(() => this.dialogRef?.close(), 2000);
              }
            }
          );
        }

      });
    };

    const createFolder = () => {
      tizen.filesystem.resolve(
        parentPath,
        (downloadsDir: any) => {
          let iqDestDir: any;
          try {
            iqDestDir = downloadsDir.resolve('IQW');
            console.log('IQW folder already exists.');
            startCopy(iqDestDir);
          } catch {
            iqDestDir = downloadsDir.createDirectory('IQW');
            console.log('IQW folder created.');
            startCopy(iqDestDir);
          }

        },
        (err: any) => {
          console.error('Error resolving Downloads folder:', err.message);
        },
        'rw'
      );
    };

    // ✅ If we need to clear previous content
    if (isClearCopyContent) {
      console.log('Clearing old content...');
      tizen.filesystem.deleteDirectory(
        folderPath,
        true,
        () => {
          console.log('Folder deleted successfully.');
          // Wait 500ms before recreating (Tizen FS cleanup delay)
          setTimeout(createFolder, 500);
        },
        (error: any) => {
          if (error.name === 'NotFoundError') {
            console.log('Folder not found — will create fresh folder.');
            createFolder();
          } else {
            console.error('Error deleting folder:', error.message);
            createFolder(); // still proceed
          }
        }
      );
    } else {
      createFolder();
    }
  }

  createIQWFolderPath(parentPath: string): void {
    try {
      tizen.filesystem.resolve(
        parentPath,
        (downloadsDir: any) => {
          try {
            // Try resolving the folder
            let iqwDir = downloadsDir.resolve('IQW');
            console.log('IQW folder already exists:', iqwDir.fullPath);
          } catch {
            // Folder not found — create it
            const iqwDir = downloadsDir.createDirectory('IQW');
            console.log('IQW folder created at:', iqwDir.fullPath);
          }
        },
        (err: any) => {
          console.error('Error resolving parent path:', err.message || err);
        },
        'rw'
      );
    } catch (outerErr: any) {
      console.error('Unexpected error in createIQWFolderPath():', outerErr.message || outerErr);
    }
  }

  copyFilesFromUSBToDownloads1(files: any[], isClearCopyContent: any): void {

    if (isClearCopyContent) {
      this.deleteFolder("/opt/usr/home/owner/content/Downloads/IQW");
    }

    tizen.filesystem.resolve(
      '/opt/usr/home/owner/content/Downloads',
      (downloadsDir: any) => {
        let iqDestDir: any;
        try {
          iqDestDir = downloadsDir.resolve('IQW');
        } catch {
          iqDestDir = downloadsDir.createDirectory('IQW');
        }
        this.dialogRef = this.dialog.open(InlineProgressDialogComponent, {
          data: { message: 'Starting copy...', indeterminate: true },
          disableClose: true,
          minWidth: '450px'
        });
        let copied = 0;
        files.forEach((file: any, index: number) => {
          const srcPath = file.downloadedUrl.replace('file://', '');
          const destPath = `${iqDestDir.fullPath}/${file.name}`;
          tizen.filesystem.copyFile(
            srcPath,
            destPath,
            true,
            () => {
              copied++;
              console.log(` Copied: ${file.name} (${index + 1}/${files.length})`);
              this.dialogRef!.componentInstance.data.message =
                `Copied: ${file.name} (${copied}/${files.length})`;


              if (copied === files.length) {
                this.dialogRef!.componentInstance.data.message = 'All files copied successfully!';
                setTimeout(() => this.dialogRef?.close(), 2000);
              }
            },
            (err: any) => {
              console.error(`Failed: ${file.name}`, err.message);
              this.dialogRef!.componentInstance.data.message = `Failed: ${file.name}`;
            }
          );
        });
      },
      (err: any) => {
        console.error('Could not access Downloads folder:', err.message);
        this.dialogRef!.componentInstance.data.message = 'Error accessing destination folder!';
      },
      'rw'
    );
  }
  deleteFolder(folderPath: string): void {
    tizen.filesystem.deleteDirectory(folderPath, true,
      function () {
        console.log('Folder deleted successfully'); tizen.filesystem.resolve(
          '/opt/usr/home/owner/content/Downloads',
          (downloadsDir: any) => {
            try {
              const iqwDir = downloadsDir.createDirectory('IQW');
              console.log('Folder recreated:', iqwDir.fullPath);
              // now safe to copy files here
            } catch (e) {
              console.error('Failed to recreate folder:', e);
            }
          },
          (err: any) => console.error('Error resolving Downloads folder:', err.message),
          'rw'
        );
      },
      function (err: any) { console.error('Error deleting folder:', err.message); }
    );
  }
}

@Component({
  selector: 'app-inline-progress-dialog',
  template: `
    <h2 mat-dialog-title>Copying Files</h2>
    <mat-dialog-content>
      <p style='color: #ff4081 !important;'>{{data.message}}</p>
      <mat-progress-bar  mode="indeterminate" *ngIf="data.indeterminate"></mat-progress-bar>
    </mat-dialog-content>
  `
})
export class InlineProgressDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { message: string; indeterminate: boolean }) { }
}