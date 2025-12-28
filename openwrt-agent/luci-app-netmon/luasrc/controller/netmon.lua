-- Copyright (C) 2024 Network Monitor
-- Licensed under the Apache License, Version 2.0

module("luci.controller.netmon", package.seeall)

function index()
    -- Main entry point under Services menu
    entry({"admin", "services", "netmon"}, alias("admin", "services", "netmon", "overview"), _("Network Monitor"), 60)

    -- Overview page (default)
    entry({"admin", "services", "netmon", "overview"}, template("netmon/overview"), _("Overview"), 10).leaf = true

    -- Traffic monitoring (replaces wrtbwmon)
    entry({"admin", "services", "netmon", "traffic"}, template("netmon/traffic"), _("Traffic"), 20).leaf = true

    -- Active connections
    entry({"admin", "services", "netmon", "connections"}, template("netmon/connections"), _("Connections"), 30).leaf = true

    -- Connected devices
    entry({"admin", "services", "netmon", "devices"}, template("netmon/devices"), _("Devices"), 40).leaf = true

    -- Settings (CBI form)
    entry({"admin", "services", "netmon", "config"}, cbi("netmon"), _("Settings"), 50).leaf = true

    -- API endpoints for AJAX calls
    entry({"admin", "services", "netmon", "api", "status"}, call("api_status")).dependent = true
    entry({"admin", "services", "netmon", "api", "devices"}, call("api_devices")).dependent = true
    entry({"admin", "services", "netmon", "api", "connections"}, call("api_connections")).dependent = true
    entry({"admin", "services", "netmon", "api", "traffic"}, call("api_traffic")).dependent = true
end

-- API: Get agent status
function api_status()
    local uci = require("luci.model.uci").cursor()
    local sys = require("luci.sys")
    local http = require("luci.http")

    local status = {
        enabled = uci:get("netmon", "main", "enabled") == "1",
        server_url = uci:get("netmon", "main", "server_url") or "",
        router_id = uci:get("netmon", "main", "router_id") or "router",
        router_name = uci:get("netmon", "main", "router_name") or "Router",
        role = uci:get("netmon", "main", "role") or "main",
        running = sys.init.enabled("netmon") and sys.call("pgrep -f netmon-agent > /dev/null") == 0
    }

    -- Get system stats
    local loadavg = sys.loadavg() or {0, 0, 0}
    status.cpu_load = string.format("%.1f", loadavg[1])

    local mem = sys.sysinfo() or {}
    if mem.totalram and mem.freeram then
        status.memory_percent = math.floor((1 - mem.freeram / mem.totalram) * 100)
    end

    -- Get temperature if available
    local temp_path = "/sys/class/thermal/thermal_zone0/temp"
    local f = io.open(temp_path, "r")
    if f then
        local temp = tonumber(f:read("*a"))
        f:close()
        if temp then
            status.temperature = math.floor(temp / 1000)
        end
    end

    http.prepare_content("application/json")
    http.write_json(status)
end

-- API: Get connected devices from DHCP leases and ARP
function api_devices()
    local http = require("luci.http")
    local sys = require("luci.sys")
    local devices = {}
    local seen = {}

    -- Parse DHCP leases
    local lease_file = io.open("/tmp/dhcp.leases", "r")
    if lease_file then
        for line in lease_file:lines() do
            local ts, mac, ip, hostname = line:match("(%d+)%s+(%S+)%s+(%S+)%s+(%S+)")
            if mac then
                mac = mac:upper()
                if not seen[mac] then
                    seen[mac] = true
                    table.insert(devices, {
                        mac = mac,
                        ip = ip,
                        hostname = hostname ~= "*" and hostname or nil,
                        lease_expires = tonumber(ts),
                        online = true
                    })
                end
            end
        end
        lease_file:close()
    end

    -- Parse ARP table for additional devices
    local arp = sys.net.arptable() or {}
    for _, entry in ipairs(arp) do
        local mac = entry["HW address"]:upper()
        if mac and mac ~= "00:00:00:00:00:00" and not seen[mac] then
            seen[mac] = true
            table.insert(devices, {
                mac = mac,
                ip = entry["IP address"],
                hostname = nil,
                online = true
            })
        end
    end

    -- Add WiFi signal strength if available
    for i, dev in ipairs(devices) do
        local signal = get_wifi_signal(dev.mac)
        if signal then
            devices[i].signal = signal
        end
    end

    http.prepare_content("application/json")
    http.write_json(devices)
end

-- Helper: Get WiFi signal for a MAC address
function get_wifi_signal(mac)
    local sys = require("luci.sys")
    local uci = require("luci.model.uci").cursor()

    -- Try each wireless interface
    uci:foreach("wireless", "wifi-iface", function(s)
        local ifname = s.ifname or s[".name"]
        if ifname then
            local output = sys.exec("iw dev " .. ifname .. " station get " .. mac .. " 2>/dev/null | grep signal:")
            local signal = output:match("signal:%s*(-?%d+)")
            if signal then
                return tonumber(signal)
            end
        end
    end)

    return nil
end

-- API: Get active connections from conntrack
function api_connections()
    local http = require("luci.http")
    local sys = require("luci.sys")
    local connections = {}

    -- Parse conntrack output
    local output = sys.exec("cat /proc/net/nf_conntrack 2>/dev/null || conntrack -L 2>/dev/null")

    for line in output:gmatch("[^\n]+") do
        local proto = line:match("^%S+%s+%d+%s+(%S+)")
        local src_ip = line:match("src=(%d+%.%d+%.%d+%.%d+)")
        local dst_ip = line:match("dst=(%d+%.%d+%.%d+%.%d+)")
        local src_port = line:match("sport=(%d+)")
        local dst_port = line:match("dport=(%d+)")
        local bytes = line:match("bytes=(%d+)")

        if src_ip and dst_ip and not is_local_ip(dst_ip) then
            table.insert(connections, {
                protocol = proto,
                src_ip = src_ip,
                dst_ip = dst_ip,
                src_port = tonumber(src_port),
                dst_port = tonumber(dst_port),
                bytes = tonumber(bytes) or 0
            })
        end
    end

    http.prepare_content("application/json")
    http.write_json(connections)
end

-- Helper: Check if IP is local/private
function is_local_ip(ip)
    if ip:match("^192%.168%.") or
       ip:match("^10%.") or
       ip:match("^172%.(1[6-9]|2%d|3[01])%.") or
       ip:match("^127%.") or
       ip:match("^224%.") or
       ip:match("^255%.") then
        return true
    end
    return false
end

-- API: Get traffic data from nlbwmon
function api_traffic()
    local http = require("luci.http")
    local sys = require("luci.sys")
    local traffic = {}

    -- Try to read nlbwmon data
    local output = sys.exec("nlbw -c json 2>/dev/null")

    if output and output ~= "" then
        local json = require("luci.jsonc")
        local data = json.parse(output)
        if data and data.columns and data.data then
            for _, row in ipairs(data.data) do
                local entry = {}
                for i, col in ipairs(data.columns) do
                    entry[col] = row[i]
                end
                table.insert(traffic, entry)
            end
        end
    end

    http.prepare_content("application/json")
    http.write_json(traffic)
end
