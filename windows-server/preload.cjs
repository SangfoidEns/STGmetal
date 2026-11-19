const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  status: () => ipcRenderer.invoke('server:status'),
  start: (opts) => ipcRenderer.invoke('server:start', opts),
  stop: () => ipcRenderer.invoke('server:stop'),
  exportClub: () => ipcRenderer.invoke('club:export'),
  importClub: () => ipcRenderer.invoke('club:import')
});
