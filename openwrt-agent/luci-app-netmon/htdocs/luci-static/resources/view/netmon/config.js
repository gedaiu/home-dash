'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return uci.load('netmon');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('netmon', 'Network Monitor Settings',
			'Configure the network monitoring agent that sends data to your dashboard server.');

		s = m.section(form.TypedSection, 'netmon', 'Agent Configuration');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', 'Enable Agent');
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'server_url', 'Server WebSocket URL');
		o.placeholder = 'ws://192.168.1.100:3000/ws/agent';
		o.rmempty = false;
		o.description = 'WebSocket URL of your dashboard server';

		o = s.option(form.Value, 'router_id', 'Router ID');
		o.placeholder = 'main';
		o.rmempty = false;
		o.description = 'Unique identifier for this router';

		o = s.option(form.Value, 'router_name', 'Router Name');
		o.placeholder = 'Main Router';
		o.description = 'Friendly name displayed in the dashboard';

		o = s.option(form.ListValue, 'role', 'Router Role');
		o.value('main', 'Main Router (Full monitoring)');
		o.value('ap', 'Access Point (Low resource mode)');
		o.default = 'main';
		o.description = 'Access Point mode uses less resources';

		s = m.section(form.TypedSection, 'netmon', 'Advanced Settings');
		s.anonymous = true;

		o = s.option(form.Value, 'batch_interval', 'Batch Interval (ms)');
		o.placeholder = '100';
		o.datatype = 'uinteger';
		o.default = '100';
		o.description = 'How often to send batched events (100-1000ms)';

		o = s.option(form.Value, 'stats_interval', 'Stats Interval (ms)');
		o.placeholder = '10000';
		o.datatype = 'uinteger';
		o.default = '10000';
		o.description = 'How often to send system stats (5000-60000ms)';

		o = s.option(form.Flag, 'conntrack_enabled', 'Connection Tracking');
		o.rmempty = false;
		o.default = '1';
		o.description = 'Stream real-time connection events';

		o = s.option(form.Flag, 'traffic_enabled', 'Traffic Statistics');
		o.rmempty = false;
		o.default = '1';
		o.description = 'Collect per-device bandwidth data';

		o = s.option(form.Value, 'max_connections', 'Max Tracked Connections');
		o.placeholder = '1000';
		o.datatype = 'uinteger';
		o.default = '1000';
		o.description = 'Limit tracked connections (100-5000)';

		return m.render();
	}
});
