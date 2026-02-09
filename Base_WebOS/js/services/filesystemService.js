/**
 * FilesystemService (ES5)
 * - Detects platform (tizen/webos/browser)
 * - Download / delete / list files on Tizen
 * - Emits simple events for download state via Events
 */
(function (window, Events, Logger) {
  var downloading = false;
  var progress = 0;

  function detectPlatform() {
    var w = window;
    if (w.PalmServiceBridge) return 'webos';
    if (w.tizen && w.tizen.filesystem && w.tizen.filesystem.resolve) return 'tizen';
    return 'browser';
  }

  function downloadFile(url, destinationDir, fileName) {
    if (detectPlatform() !== 'tizen') return Promise.resolve(url);

    return new Promise(function (resolve) {
      try {
        var finalName = fileName || url.split('/').pop();
        var request = new tizen.DownloadRequest(url, destinationDir, finalName);
        downloading = true;
        progress = 0;
        Events.emit('fs:downloading', downloading);

        tizen.download.start(request, {
          onprogress: function (id, received, total) {
            if (total > 0) {
              progress = Math.min(100, (received / total) * 100);
              Events.emit('fs:progress', progress);
            }
          },
          oncompleted: function (id, path) {
            downloading = false;
            progress = 0;
            Events.emit('fs:downloading', downloading);
            Events.emit('fs:progress', progress);
            resolve(path);
          },
          onfailed: function () {
            downloading = false;
            progress = 0;
            Events.emit('fs:downloading', downloading);
            resolve(url); // fall back to remote URL
          }
        });
      } catch (e) {
        resolve(url);
      }
    });
  }

  function deleteFile(fileUrl) {
    return new Promise(function (resolve, reject) {
      if (detectPlatform() !== 'tizen') return resolve();
      var path = fileUrl.replace(/^file:\/\//, '');
      tizen.filesystem.deleteFile(path, resolve, reject);
    });
  }

  function deleteAllFiles(root) {
    return new Promise(function (resolve, reject) {
      if (detectPlatform() !== 'tizen') return resolve();
      try {
        tizen.filesystem.resolve(root, function (dir) {
          dir.listFiles(function (files) {
            if (!files.length) return resolve();
            var pending = files.length;
            files.forEach(function (f) {
              var done = function () {
                if (--pending === 0) resolve();
              };
              if (f.isDirectory) tizen.filesystem.deleteDirectory(f.toURI(), true, done, reject);
              else tizen.filesystem.deleteFile(f.toURI(), done, reject);
            });
          }, reject);
        }, reject, 'rw');
      } catch (e) {
        reject(e);
      }
    });
  }

  // Delete everything (files + subfolders) inside a root
  function deleteAllFilesWithFolder(root) {
    return new Promise(function (resolve, reject) {
      if (detectPlatform() !== 'tizen') return resolve();
      try {
        tizen.filesystem.resolve(root, function (dir) {
          dir.listFiles(function (files) {
            if (!files.length) return resolve();
            var pending = files.length;
            files.forEach(function (f) {
              var done = function () { if (--pending === 0) resolve(); };
              if (f.isDirectory) tizen.filesystem.deleteDirectory(f.toURI(), true, done, reject);
              else tizen.filesystem.deleteFile(f.toURI(), done, reject);
            });
          }, reject);
        }, reject, 'rw');
      } catch (e) { reject(e); }
    });
  }

  function countPendrivesWithIQFolder(folderName) {
    if (detectPlatform() !== 'tizen') return Promise.resolve({ totalPendrives: 0, pendrivesWithIQ: [] });

    return new Promise(function (resolve) {
      try {
        tizen.filesystem.listStorages(function (storages) {
          var usb = storages.filter(function (s) { return s.type === 'EXTERNAL' && s.state === 'MOUNTED'; });
          var res = [];
          var pending = usb.length;
          if (!pending) return resolve({ totalPendrives: 0, pendrivesWithIQ: [] });

          usb.forEach(function (d) {
            tizen.filesystem.resolve(d.label + '/' + folderName,
              function () { res.push(d.label); if (--pending === 0) resolve({ totalPendrives: usb.length, pendrivesWithIQ: res }); },
              function () { if (--pending === 0) resolve({ totalPendrives: usb.length, pendrivesWithIQ: res }); },
              'r');
          });
        }, function () { resolve({ totalPendrives: 0, pendrivesWithIQ: [] }); });
      } catch (e) {
        resolve({ totalPendrives: 0, pendrivesWithIQ: [] });
      }
    });
  }

  function listAllFilesOnStorage(storageLabel, directoryPath) {
    if (detectPlatform() !== 'tizen') return Promise.resolve([]);
    return new Promise(function (resolve, reject) {
      tizen.filesystem.resolve(storageLabel + (directoryPath ? '/' + directoryPath : ''), function (dir) {
        dir.listFiles(function (files) {
          var list = files
            .filter(function (f) { return !f.isDirectory; })
            .sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }); })
            .map(function (f, i) { return { name: f.name, downloadedUrl: f.toURI(), Url: f.toURI(), id: i }; });
          resolve(list);
        }, reject);
      }, reject, 'r');
    });
  }

  function listAllSubfolders(root) {
    if (detectPlatform() !== 'tizen') return Promise.resolve([]);
    return new Promise(function (resolve, reject) {
      try {
        tizen.filesystem.resolve(root, function (dir) {
          dir.listFiles(function (files) {
            resolve(files.filter(function (f) { return f.isDirectory; }).map(function (f) { return f.fullPath || f.name; }));
          }, reject);
        }, reject, 'r');
      } catch (e) { reject(e); }
    });
  }

  function hasEnoughStorage(requiredMB) {
    requiredMB = requiredMB || 300;
    return new Promise(function (resolve) {
      if (detectPlatform() !== 'tizen') return resolve(true);
      try {
        tizen.systeminfo.getPropertyValue('STORAGE', function (storages) {
          var s = storages.units && storages.units.find(function (u) { return u.type === 'INTERNAL'; }) || storages.units && storages.units[0];
          if (!s) return resolve(false);
          resolve((s.availableCapacity / (1024 * 1024)) >= requiredMB);
        }, function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
  }

  function getStorageInfo() {
    return new Promise(function (resolve, reject) {
      if (detectPlatform() !== 'tizen') return resolve({ totalGB: '0', usedGB: '0', remainingGB: '0' });
      try {
        tizen.systeminfo.getPropertyValue('STORAGE', function (storage) {
          var internal = storage.units && storage.units.find(function (u) { return u.type === 'INTERNAL'; }) || storage.units[0];
          var total = internal.capacity;
          var available = internal.availableCapacity;
          var used = total - available;
          var toGB = function (b) { return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB'; };
          resolve({ totalGB: toGB(total), usedGB: toGB(used), remainingGB: toGB(available) });
        }, reject);
      } catch (e) { reject(e); }
    });
  }

  function createIQWFolderPath(parentPath) {
    if (detectPlatform() !== 'tizen') return;
    try {
      tizen.filesystem.resolve(parentPath, function (downloadsDir) {
        try { downloadsDir.resolve('IQW'); }
        catch (_) { downloadsDir.createDirectory('IQW'); }
      }, function (err) { console.error('createIQWFolderPath resolve error', err); }, 'rw');
    } catch (err) { console.error('createIQWFolderPath failed', err); }
  }

  window.FilesystemService = {
    detectPlatform: detectPlatform,
    downloadFile: downloadFile,
    deleteFile: deleteFile,
    deleteAllFiles: deleteAllFiles,
    deleteAllFilesWithFolder: deleteAllFilesWithFolder,
    countPendrivesWithIQFolder: countPendrivesWithIQFolder,
    listAllFilesOnStorage: listAllFilesOnStorage,
    listAllSubfolders: listAllSubfolders,
    hasEnoughStorage: hasEnoughStorage,
    getStorageInfo: getStorageInfo,
    createIQWFolderPath: createIQWFolderPath
  };
})(window, Events, Logger);
