const { app, Tray, Menu, nativeImage, dialog } = require('electron');
const { spawn } = require('child_process');
const Store = require('electron-store').default;
const path = require('path');
const treeKill = require('tree-kill');

//#region 变量定义

const store = new Store({
    defaults: {
        trayConfig: {
            autoLaunchRssHub: false,
            rssHubPath: null,
        }
    }
});
const savedConfig = store.get('trayConfig');
const iconPath = path.join(__dirname, '..', 'asset/icon.png');
const defaultIcon = nativeImage.createFromPath(iconPath);

let tray = null;
let serverProcess = null;

//#endregion

//#region electron相关

app.whenReady().then(() => {
    const trayIcon = defaultIcon.resize({ width: 16, height: 16 }); 

    tray = new Tray(trayIcon);
    tray.setToolTip('RssHub');

    updateTrayMenu(false); 

    if (savedConfig.autoLaunchRssHub) {
        startServer();
    }

    showBalloon('启动成功', 'RssHubLauncher正在后台运行...');
});

app.dock?.hide(); 

app.on('before-quit', (event) => {
    if (serverProcess) {
        event.preventDefault(); 
        stopServer();
        setTimeout(() => {
            app.quit();
        }, 1000);
    }
});

//#endregion

//#region 右键菜单相关
function updateTrayMenu(serverIsRunning) {
    const menu = [];
    menu.push(
        {
            label: serverIsRunning ? '🟢 RssHub运行中' : '⚫ RssHub已停止',
            enabled: false 
        }
    );

    if (savedConfig.rssHubPath) {
        menu.push(
            { type: 'separator' },
            {
                label: `当前RssHub路径`,
                submenu: [
                    {
                        label: `${shortenPath(savedConfig.rssHubPath, 5)}`,
                        enabled: false
                    },
                    {
                        label: `更改路径...`,
                        click: () => selectRssHubPath(serverIsRunning)
                    }
                ]
            },
            { type: 'separator' },
            {
                label: '启动RssHub',
                click: startServer,
                enabled: !serverIsRunning 
            },
            {
                label: '停止RssHub',
                click: stopServer,
                enabled: serverIsRunning 
            },
        );
    }
    else {
        menu.push(
            { type: 'separator' },
            {
                label: '选择RssHub路径',
                click: () => selectRssHubPath(serverIsRunning)
            }
        );
    }

    menu.push(
        { type: 'separator' },
        {
            type : 'checkbox',
            label: '开机启动',
            checked : app.getLoginItemSettings().openAtLogin,
            click : function () {
                if(!app.isPackaged){
                    app.setLoginItemSettings({
                        openAtLogin: !app.getLoginItemSettings().openAtLogin,
                        path: process.execPath
                    })
                }else{
                    app.setLoginItemSettings({
                        openAtLogin: !app.getLoginItemSettings().openAtLogin
                    })
                }
                console.log(app.getLoginItemSettings().openAtLogin)
                console.log(!app.isPackaged);
            }
        },
        {
            type : 'checkbox',
            label: '启动时运行RssHub',
            checked : savedConfig.autoLaunchRssHub,
            click : function (menuItem) {
                savedConfig.autoLaunchRssHub = menuItem.checked;
                store.set('trayConfig', savedConfig);
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
        
                if (serverProcess) {
                    stopServer();
          
                    setTimeout(() => {
                        app.quit();
                    }, 1000);
                } else {
                    app.quit();
                }
            }
        }
    );

    const contextMenu = Menu.buildFromTemplate(menu);
    tray.setContextMenu(contextMenu);
}

//#endregion

//#region RssHub相关

function startServer() {
    if (serverProcess) {
        console.log('RssHub已经在运行！');
        return;
    }

    if (!savedConfig.rssHubPath) {
        console.error('RssHub路径未配置，无法启动RssHub。');
        return
    }

    console.log('运行RssHub！');
    serverProcess = spawn('pnpm', ['start'], {
        cwd: savedConfig.rssHubPath,//path.join(__dirname, '..', 'RSSHub'), 
        stdio: 'ignore', 
        shell: true 
    });

    serverProcess.on('error', (err) => {
        console.error('启动RssHub失败:', err);
        serverProcess = null;
        updateTrayMenu(false);
    });

    serverProcess.on('exit', (code, signal) => {
        console.log(`RssHub进程已退出，代码: ${code}, 信号: ${signal}`);
        serverProcess = null;
        updateTrayMenu(false);
    });

  
    updateTrayMenu(true);
    tray.setToolTip('RssHub - 运行中');
}

function stopServer() {
    if (!serverProcess) {
        console.log('RssHub并未运行。');
        return;
    }

    treeKill(serverProcess.pid, 'SIGTERM', (err) => {
        if (err) {
            console.error('停止RssHub失败:', err);
      
            treeKill(serverProcess.pid, 'SIGKILL');
        }
        serverProcess = null;
        console.log('RssHub已停止');
    });
}

//#endregion

//#region 辅助方法相关

function selectRssHubPath(serverIsRunning) {
    dialog.showOpenDialog({
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            savedConfig.rssHubPath = result.filePaths[0];
            store.set('trayConfig', savedConfig);
            updateTrayMenu(serverIsRunning);
        }
    }).catch(err => {
        console.error('选择RssHub路径出错:', err);
    });
}

function shortenPath(pathStr, depth) {
    const segments = pathStr.split(path.sep);
    if (segments.length <= depth) {
        return pathStr;
    }
    return '...' + segments.slice(-depth).join(path.sep);
}

function showBalloon(title, content) {
    if (process.platform === 'win32' && tray.displayBalloon) {
        tray.displayBalloon({
            icon: defaultIcon,
            title: title,
            content: content
        });
    } else {
        // 降级到控制台输出
        console.log(`[通知] ${title}: ${content}`); 
    }
}

//#endregion
