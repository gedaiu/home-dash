'use strict';
'require view';
'require ui';
'require rpc';
'require fs';

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

return view.extend({
	load: function() {
		return Promise.all([
			callSystemInfo(),
			fs.read('/etc/config/netmon'),
			fs.exec('/bin/sh', ['-c', 'pgrep -f netmon-agent >/dev/null 2>&1 && echo running || echo stopped']),
			fs.exec('/bin/sh', ['-c', 'pgrep -f netmon-agent | head -1 | xargs -I{} cat /proc/{}/stat 2>/dev/null | cut -d" " -f22'])
		]);
	},

	render: function(data) {
		var sysInfo = data[0] || {};
		var config = data[1] || '';
		var agentStatus = (data[2] && data[2].stdout) ? data[2].stdout.trim() : 'unknown';
		var processStartTicks = (data[3] && data[3].stdout) ? parseInt(data[3].stdout.trim(), 10) : 0;

		var serverUrl = '';
		var routerId = 'router';
		var routerName = 'Router';
		var role = 'main';
		var enabled = '1';

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
				}
			}
		}

		var memory = sysInfo.memory || {};
		var memPercent = memory.total ? Math.round((1 - memory.available / memory.total) * 100) : 0;

		var load = sysInfo.load || [0, 0, 0];
		var cpuLoad = (load[0] / 65536).toFixed(2);

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
			statusColor = 'gray';
		} else if (isRunning) {
			statusText = 'Connected';
			statusColor = 'green';
		} else {
			statusText = 'Disconnected';
			statusColor = 'red';
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'Network Monitor'),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Server Connection'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width: 200px;' }, 'Connection Status'),
						E('td', { 'class': 'td' }, [
							E('span', {
								'style': 'display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; background-color: ' + statusColor + ';'
							}),
							E('strong', { 'style': 'color: ' + statusColor + ';' }, statusText)
						])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Agent Process'),
						E('td', { 'class': 'td' }, isRunning ?
							E('span', { 'style': 'color: green;' }, 'Running') :
							E('span', { 'style': 'color: red;' }, 'Stopped'))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Connected For'),
						E('td', { 'class': 'td' }, isRunning && connectionUptime > 0 ?
							this.formatUptime(connectionUptime) :
							E('em', { 'style': 'color: gray;' }, '-'))
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Server URL'),
						E('td', { 'class': 'td' }, serverUrl || E('em', { 'style': 'color: gray;' }, '(not configured)'))
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
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'System Health'),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width: 200px;' }, 'CPU Load'),
						E('td', { 'class': 'td' }, [
							E('div', { 'style': 'display: flex; align-items: center; gap: 10px;' }, [
								E('div', {
									'style': 'width: 100px; height: 10px; background: #eee; border-radius: 5px; overflow: hidden;'
								}, [
									E('div', {
										'style': 'width: ' + Math.min(cpuLoad * 10, 100) + '%; height: 100%; background: ' + (cpuLoad > 8 ? 'red' : cpuLoad > 4 ? 'orange' : 'green') + ';'
									})
								]),
								cpuLoad
							])
						])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Memory Usage'),
						E('td', { 'class': 'td' }, [
							E('div', { 'style': 'display: flex; align-items: center; gap: 10px;' }, [
								E('div', {
									'style': 'width: 100px; height: 10px; background: #eee; border-radius: 5px; overflow: hidden;'
								}, [
									E('div', {
										'style': 'width: ' + memPercent + '%; height: 100%; background: ' + (memPercent > 90 ? 'red' : memPercent > 70 ? 'orange' : 'green') + ';'
									})
								]),
								memPercent + '%'
							])
						])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, 'Uptime'),
						E('td', { 'class': 'td' }, this.formatUptime(sysInfo.uptime || 0))
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; gap: 10px;' }, [
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
					}, 'Restart Agent')
				])
			])
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

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
