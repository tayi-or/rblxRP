import discord from "./discord";
import stateManager from "./state/stateManager";
import config from "./config";
import SysTray from "systray";
import icon from "./icon"
import {spawn} from "child_process";
import WebSocket from "ws";
import {URL} from "url";
import {notify} from "node-notifier";
import {join} from "path";
import fetch from "node-fetch";

process.env["EZP-DEBUG"] = 'true'

function openURL(url) {
    if (process.platform === "darwin") {
        spawn("open", [url]);
    } else if (process.platform === "win32") {
        spawn("rundll32", ["url.dll,FileProtocolHandler", url]);
    } else if (process.platform === "linux") {
        spawn("xdg-open", [url]);
    }
}

function openConfig() {
    if (global["wss"]) global["wss"].close();
    const wss = new WebSocket.Server({
        port: 5816,
        host: "127.0.0.1"
    });
    global["wss"] = wss;
    console.log("listening");
    wss.on("connection", (conn, req) => {
        console.log("incoming", req.headers.origin);
        if (new URL(req.headers.origin).host !== "rblxrp.xyz") return conn.close();
        if (wss.clients.size > 1) return conn.close();
        conn.on("close", () => wss.close())
        conn.on("message", (msg) => {
            var j = JSON.parse(msg.toString());
            for (var k in j)
                if (typeof config[k] == typeof j[k]) config[k] = j[k];
            wsBroadcast();
        });
        notify({
            title: "Opening config...",
            message: "Config was opened in your default browser.",
            icon: join(__dirname, "..", "ico", "logo.png"),
            contentImage: join(__dirname, "..", "ico", "logo.png")
        });
        wsBroadcast()
    });


    openURL("http://rblxrp.xyz/config.html")
}

function wsBroadcast() {
    if (!global["wss"]) return;
    for (var client of global["wss"].clients) setTimeout(() => client.send(JSON.stringify({
        state: stateManager.state,
        config: config,
        discord: {
            env: discord.environment,
            status: discord.status
        },
        version: require("../package.json").version
    })), 15);
}
discord.on("DISPATCH", wsBroadcast);
discord.on("connected", wsBroadcast);
discord.on("disconnected", wsBroadcast);
discord.on("connecting", wsBroadcast);
stateManager.on("updateState", wsBroadcast);;
(async () => {
    var firstItem = "Open Config";
    try {
        var releasesF = await fetch("https://api.github.com/repos/rblxRP/rblxRP/releases");
        var releasesJ = await releasesF.json();
        var first = releasesJ[0];
        if (first.tag_name != require("../package.json").version) {
            //firstItem = "Update rblxRP";
        }

    } catch (e) {
        console.error("[Updt]", e)
    }

    const tray = new SysTray({
        menu: {
            icon,
            title: "",
            tooltip: "rblxRP",
            items: [{
                    title: firstItem,
                    tooltip: "Open in the default web browser",
                    enabled: true,
                    checked: false
                },
                {
                    title: "Quit",
                    tooltip: "Exits out of rblxRP",
                    enabled: true,
                    checked: false
                }
            ]
        }
    })
    tray.onClick((action) => {
        switch (action.item.title) {
            case "Open Config":
                openConfig()
                break;
            case "Update rblxRP":
                openURL("http://rblxrp.xyz");
                break;
            case "Quit":
                tray.kill();
                process.exit();
        }
    })

    // eslint-disable-next-line dot-notation
    global["tray"] = tray; // To prevent win from being garbage collected.
})()