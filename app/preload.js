'use strict';
// Only the shell UI gets this bridge. The web pages (apps) get nothing.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('kiosk', {
  init: () => call('ui:init'),
  login: (id, pw) => call('auth:login', id, pw),
  logout: () => call('auth:logout'),
  openApp: (id) => call('app:open', id),
  home: () => call('app:home'),
  status: () => call('sys:status'),
  wifiList: () => call('wifi:list'),
  wifiConnect: (ssid, pw) => call('wifi:connect', ssid, pw),
  powerOff: () => call('power:off'),

  adminLogin: (user, pw) => call('admin:login', user, pw),
  adminLogout: () => call('admin:logout'),
  adminData: () => call('admin:data'),
  saveApp: (a) => call('admin:saveApp', a),
  deleteApp: (id) => call('admin:deleteApp', id),
  saveUser: (u) => call('admin:saveUser', u),
  deleteUser: (id) => call('admin:deleteUser', id),
  setAdminPassword: (oldPw, newPw) => call('admin:setPassword', oldPw, newPw),
  terminal: () => call('admin:terminal'),
  update: () => call('admin:update'),
  reboot: () => call('admin:reboot'),

  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onAdminPrompt: (cb) => ipcRenderer.on('admin:prompt', () => cb()),
});
