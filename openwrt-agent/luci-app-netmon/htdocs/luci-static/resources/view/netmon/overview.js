'use strict';
'require view';
'require ui';
'require rpc';
'require fs';
'require poll';

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return view.extend({
	pollInterval: 5,

	load: function() {
		return Promise.all([
			callSystemInfo(),
			fs.read('/etc/config/netmon'),
			fs.exec('/bin/sh', ['-c', 'pgrep -f netmon-agent >/dev/null 2>&1 && echo running || echo stopped']),
			fs.exec('/bin/sh', ['-c', 'PID=$(pgrep -f netmon-agent | head -1); [ -n "$PID" ] && awk "{print \\$22}" /proc/$PID/stat 2>/dev/null || echo 0']),
			fs.exec('/bin/sh', ['-c', 'cat /tmp/dhcp.leases 2>/dev/null | wc -l']),
			fs.exec('/bin/sh', ['-c', 'conntrack -C 2>/dev/null || cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null || echo 0']),
			fs.exec('/bin/sh', ['-c', 'iwinfo 2>/dev/null | grep -c "ESSID" || echo 0']),
			fs.exec('/bin/sh', ['-c', 'cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0']),
			fs.exec('/bin/sh', ['-c', 'cat /proc/net/dev 2>/dev/null']),
			fs.exec('/bin/sh', ['-c', 'cat /tmp/dhcp.leases 2>/dev/null'])
		]);
	},

	render: function(data) {
		var sysInfo = data[0] || {};
		var config = data[1] || '';
		var agentStatus = (data[2] && data[2].stdout) ? data[2].stdout.trim() : 'unknown';
		var procStat = (data[3] && data[3].stdout) ? data[3].stdout.trim() : '';
		var dhcpLeases = (data[4] && data[4].stdout) ? parseInt(data[4].stdout.trim(), 10) : 0;
		var conntrackCount = (data[5] && data[5].stdout) ? parseInt(data[5].stdout.trim(), 10) : 0;
		var wifiInterfaces = (data[6] && data[6].stdout) ? parseInt(data[6].stdout.trim(), 10) : 0;
		var cpuTemp = (data[7] && data[7].stdout) ? parseInt(data[7].stdout.trim(), 10) / 1000 : 0;
		var netDevOutput = (data[8] && data[8].stdout) ? data[8].stdout : '';
		var dhcpLeasesOutput = (data[9] && data[9].stdout) ? data[9].stdout : '';

		// Parse network interface stats
		var interfaces = this.parseNetDev(netDevOutput);
		var totalRx = 0, totalTx = 0;
		var wanIface = interfaces['eth1'] || interfaces['wan'] || interfaces['pppoe-wan'] || null;
		var lanIface = interfaces['br-lan'] || interfaces['eth0'] || null;

		for (var iface in interfaces) {
			if (iface !== 'lo') {
				totalRx += interfaces[iface].rx;
				totalTx += interfaces[iface].tx;
			}
		}

		// Parse DHCP leases for device list
		var devices = this.parseDhcpLeases(dhcpLeasesOutput);

		// Parse process start time (field 22 from /proc/PID/stat)
		var processStartTicks = (data[3] && data[3].stdout) ? parseInt(data[3].stdout.trim(), 10) : 0;

		var serverUrl = '';
		var routerId = 'router';
		var routerName = 'Router';
		var role = 'main';
		var enabled = '1';
		var conntrackEnabled = '1';
		var statsInterval = '10000';

		// Parse UCI config
		var lines = config.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var match = lines[i].match(/option\s+(\w+)\s+'([^']*)'/);
			if (match) {
				switch (match[1]) {
					case 'server_url': serverUrl = match[2]; break;
					case 'router_id': routerId = match[2]; break;
					case 'router_name': routerName = match[2]; break;
					case 'role': role = match[2]; break;
					case 'enabled': enabled = match[2]; break;
					case 'conntrack_enabled': conntrackEnabled = match[2]; break;
					case 'stats_interval': statsInterval = match[2]; break;
				}
			}
		}

		var memory = sysInfo.memory || {};
		var memTotal = memory.total || 0;
		var memAvail = memory.available || 0;
		var memPercent = memTotal ? Math.round((1 - memAvail / memTotal) * 100) : 0;
		var memUsedMB = ((memTotal - memAvail) / 1024 / 1024).toFixed(0);
		var memTotalMB = (memTotal / 1024 / 1024).toFixed(0);

		var load = sysInfo.load || [0, 0, 0];
		var cpuLoad1 = (load[0] / 65536).toFixed(2);
		var cpuLoad5 = (load[1] / 65536).toFixed(2);
		var cpuLoad15 = (load[2] / 65536).toFixed(2);

		var isRunning = agentStatus === 'running';
		var isConfigured = enabled === '1' && serverUrl;

		var connectionUptime = 0;
		if (isRunning && processStartTicks > 0 && sysInfo.uptime) {
			var ticksPerSecond = 100;
			var processStartSeconds = processStartTicks / ticksPerSecond;
			connectionUptime = Math.max(0, sysInfo.uptime - processStartSeconds);
		}

		var statusText, statusColor;
		if (!isConfigured) {
			statusText = 'Not Configured';
			statusColor = '#888';
		} else if (isRunning) {
			statusText = 'Connected';
			statusColor = '#5cb85c';
		} else {
			statusText = 'Disconnected';
			statusColor = '#d9534f';
		}

		var view = this;

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Network Monitor'),

			// Status Cards Row
			E('div', { 'style': 'display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;' }, [
				this.renderStatusCard('Agent Status', statusText, statusColor, isRunning ? 'Running for ' + this.formatUptime(connectionUptime) : 'Process stopped'),
				this.renderStatusCard('DHCP Clients', dhcpLeases.toString(), '#5bc0de', 'Active leases'),
				this.renderStatusCard('Connections', conntrackCount.toString(), '#f0ad4e', 'Active flows'),
				this.renderStatusCard('WiFi Radios', wifiInterfaces.toString(), '#5cb85c', 'Active interfaces')
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Agent Configuration'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width: 200px;' }, 'Server URL'),
						E('td', { 'class': 'td' }, serverUrl || E('em', { 'style': 'color: #888;' }, '(not configured)'))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Router ID'),
						E('td', { 'class': 'td' }, routerId)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Router Name'),
						E('td', { 'class': 'td' }, routerName)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Role'),
						E('td', { 'class': 'td' }, role === 'main' ? 'Main Router (Full monitoring)' : 'Access Point (Low resource)')
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Connection Tracking'),
						E('td', { 'class': 'td' }, conntrackEnabled === '1' ?
							E('span', { 'style': 'color: #5cb85c;' }, 'Enabled') :
							E('span', { 'style': 'color: #888;' }, 'Disabled'))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Stats Interval'),
						E('td', { 'class': 'td' }, (parseInt(statsInterval, 10) / 1000) + ' seconds')
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'System Resources'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width: 200px;' }, 'CPU Load'),
						E('td', { 'class': 'td' }, [
							E('div', { 'style': 'display: flex; align-items: center; gap: 10px;' }, [
								this.renderProgressBar(Math.min(parseFloat(cpuLoad1) * 10, 100), cpuLoad1 > 8 ? '#d9534f' : cpuLoad1 > 4 ? '#f0ad4e' : '#5cb85c'),
								E('span', {}, cpuLoad1 + ' / ' + cpuLoad5 + ' / ' + cpuLoad15)
							])
						])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Memory Usage'),
						E('td', { 'class': 'td' }, [
							E('div', { 'style': 'display: flex; align-items: center; gap: 10px;' }, [
								this.renderProgressBar(memPercent, memPercent > 90 ? '#d9534f' : memPercent > 70 ? '#f0ad4e' : '#5cb85c'),
								E('span', {}, memPercent + '% (' + memUsedMB + ' / ' + memTotalMB + ' MB)')
							])
						])
					]),
					cpuTemp > 0 ? E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'CPU Temperature'),
						E('td', { 'class': 'td' }, [
							E('div', { 'style': 'display: flex; align-items: center; gap: 10px;' }, [
								this.renderProgressBar(Math.min(cpuTemp, 100), cpuTemp > 80 ? '#d9534f' : cpuTemp > 60 ? '#f0ad4e' : '#5cb85c'),
								E('span', {}, cpuTemp.toFixed(1) + ' C')
							])
						])
					]) : '',
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'System Uptime'),
						E('td', { 'class': 'td' }, this.formatUptime(sysInfo.uptime || 0))
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Network Traffic'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width: 200px;' }, 'Total Downloaded'),
						E('td', { 'class': 'td' }, [
							E('span', { 'style': 'color: #5cb85c; font-weight: bold;' }, this.formatBytes(totalRx))
						])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Total Uploaded'),
						E('td', { 'class': 'td' }, [
							E('span', { 'style': 'color: #f0ad4e; font-weight: bold;' }, this.formatBytes(totalTx))
						])
					]),
					wanIface ? E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'WAN Traffic'),
						E('td', { 'class': 'td' }, [
							E('span', { 'style': 'color: #5cb85c;' }, '↓ ' + this.formatBytes(wanIface.rx)),
							E('span', { 'style': 'margin: 0 10px;' }, '/'),
							E('span', { 'style': 'color: #f0ad4e;' }, '↑ ' + this.formatBytes(wanIface.tx))
						])
					]) : '',
					lanIface ? E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'LAN Traffic'),
						E('td', { 'class': 'td' }, [
							E('span', { 'style': 'color: #5cb85c;' }, '↓ ' + this.formatBytes(lanIface.rx)),
							E('span', { 'style': 'margin: 0 10px;' }, '/'),
							E('span', { 'style': 'color: #f0ad4e;' }, '↑ ' + this.formatBytes(lanIface.tx))
						])
					]) : ''
				])
			]),

			devices.length > 0 ? E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Connected Devices (' + devices.length + ')'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr cbi-section-table-titles' }, [
						E('th', { 'class': 'th' }, 'Hostname'),
						E('th', { 'class': 'th' }, 'IP Address'),
						E('th', { 'class': 'th' }, 'MAC Address')
					])
				].concat(devices.slice(0, 10).map(function(device) {
					return E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, device.hostname || E('em', { 'style': 'color: #888;' }, 'Unknown')),
						E('td', { 'class': 'td' }, device.ip),
						E('td', { 'class': 'td', 'style': 'font-family: monospace; font-size: 12px;' }, device.mac)
					]);
				})).concat(devices.length > 10 ? [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'colspan': '3', 'style': 'text-align: center; color: #888;' },
							'... and ' + (devices.length - 10) + ' more devices')
					])
				] : []))
			]) : '',

			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; gap: 10px; align-items: center;' }, [
					E('a', {
						'href': '/cgi-bin/luci/admin/services/netmon/config',
						'class': 'cbi-button cbi-button-action'
					}, 'Configure Settings'),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/etc/init.d/netmon', ['restart']).then(function() {
								ui.addNotification(null, E('p', 'Agent restarted'), 'info');
								window.setTimeout(function() { location.reload(); }, 2000);
							});
						})
					}, 'Restart Agent'),
					E('button', {
						'class': 'cbi-button',
						'click': function() { location.reload(); }
					}, 'Refresh'),
					E('span', { 'style': 'margin-left: auto; color: #888; font-size: 12px;' }, 'Auto-refresh: 5s')
				])
			])
		]);
	},

	renderStatusCard: function(title, value, color, subtitle) {
		return E('div', {
			'class': 'cbi-section',
			'style': 'border-radius: 4px; padding: 15px; min-width: 140px; text-align: center; margin: 0;'
		}, [
			E('div', { 'style': 'font-size: 12px; opacity: 0.7; text-transform: uppercase; margin-bottom: 5px;' }, title),
			E('div', { 'style': 'font-size: 24px; font-weight: bold; color: ' + color + ';' }, value),
			E('div', { 'style': 'font-size: 11px; opacity: 0.5; margin-top: 5px;' }, subtitle)
		]);
	},

	renderProgressBar: function(percent, color) {
		return E('div', {
			'style': 'width: 120px; height: 10px; background: var(--border-color-medium, #eee); border-radius: 5px; overflow: hidden;'
		}, [
			E('div', {
				'style': 'width: ' + percent + '%; height: 100%; background: ' + color + '; transition: width 0.3s;'
			})
		]);
	},

	formatUptime: function(seconds) {
		var days = Math.floor(seconds / 86400);
		var hours = Math.floor((seconds % 86400) / 3600);
		var mins = Math.floor((seconds % 3600) / 60);

		var parts = [];
		if (days > 0) parts.push(days + 'd');
		if (hours > 0) parts.push(hours + 'h');
		parts.push(mins + 'm');

		return parts.join(' ');
	},

	formatBytes: function(bytes) {
		if (bytes === 0) return '0 B';
		var units = ['B', 'KB', 'MB', 'GB', 'TB'];
		var i = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
	},

	parseNetDev: function(output) {
		var interfaces = {};
		var lines = output.split('\n');

		for (var i = 2; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;

			var parts = line.split(/[:\s]+/);
			if (parts.length >= 10) {
				var iface = parts[0];
				interfaces[iface] = {
					rx: parseInt(parts[1], 10) || 0,
					tx: parseInt(parts[9], 10) || 0,
					rxPackets: parseInt(parts[2], 10) || 0,
					txPackets: parseInt(parts[10], 10) || 0
				};
			}
		}

		return interfaces;
	},

	parseDhcpLeases: function(output) {
		var devices = [];
		var lines = output.split('\n');

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line) continue;

			var parts = line.split(/\s+/);
			if (parts.length >= 4) {
				devices.push({
					timestamp: parseInt(parts[0], 10),
					mac: parts[1].toUpperCase(),
					ip: parts[2],
					hostname: parts[3] === '*' ? '' : parts[3]
				});
			}
		}

		return devices.sort(function(a, b) {
			return b.timestamp - a.timestamp;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
