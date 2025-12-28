import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useRef, useState } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac } from '../state.js';

let d3Promise = null;

function loadD3() {
  if (!d3Promise) {
    d3Promise = import('https://esm.sh/d3@7.8.5');
  }
  return d3Promise;
}

function getNodeColor(node, isSelected, isConnectedToSelected) {
  if (isSelected) {
    return '#00ff88';
  }
  if (isConnectedToSelected) {
    return '#ffff00';
  }
  if (node.type === 'device') {
    return node.online ? '#ff8c00' : '#4a4a4a';
  }

  const countryColors = {
    'US': '#ff6b35',
    'DE': '#ffa500',
    'GB': '#ffb347',
    'NL': '#ffd700',
    'FR': '#ff9500',
    'CN': '#ff4500',
    'JP': '#ff7f50',
    'KR': '#ff6347',
    'AU': '#ffae42',
    'CA': '#ff8c00'
  };

  return countryColors[node.country] || '#cc7000';
}

function getNodeRadius(node, isSelected) {
  const baseRadius = node.type === 'device' ? 16 : Math.min(12 + Math.log2((node.connectionCount || 1) + 1) * 4, 28);
  return isSelected ? baseRadius * 1.3 : baseRadius;
}

function buildGraphData(connections, devices) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  devices.forEach(device => {
    const id = `device:${device.mac}`;
    if (!nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        type: 'device',
        label: device.hostname || device.mac.substring(0, 8),
        mac: device.mac,
        ip: device.ip,
        online: device.online
      });
    }
  });

  connections.forEach(conn => {
    if (!conn.srcMac || !conn.enriched) {
      return;
    }

    const srcId = `device:${conn.srcMac}`;
    const org = conn.enriched.org || conn.enriched.asName || conn.enriched.isp;
    const country = conn.enriched.country;
    const dstLabel = org || country || conn.dst_ip;
    const dstId = `external:${dstLabel}`;

    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, {
        id: srcId,
        type: 'device',
        label: conn.srcHostname || conn.srcMac?.substring(0, 8) || 'Unknown',
        mac: conn.srcMac,
        ip: conn.src_ip,
        online: true
      });
    }

    if (!nodeMap.has(dstId)) {
      nodeMap.set(dstId, {
        id: dstId,
        type: 'external',
        label: dstLabel,
        country: country,
        org: org,
        connectionCount: 0
      });
    }

    const dstNode = nodeMap.get(dstId);
    dstNode.connectionCount = (dstNode.connectionCount || 0) + 1;

    const linkId = `${srcId}->${dstId}`;
    const existingLink = links.find(l => l.id === linkId);
    if (existingLink) {
      existingLink.weight += 1;
      existingLink.bytes += (conn.bytes || 0);
    } else {
      links.push({
        id: linkId,
        source: srcId,
        target: dstId,
        weight: 1,
        bytes: conn.bytes || 0,
        protocol: conn.protocol,
        srcMac: conn.srcMac
      });
    }
  });

  nodeMap.forEach(node => nodes.push(node));

  return { nodes, links };
}

export function ConnectionGraph() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simulationRef = useRef(null);
  const [d3, setD3] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedMac, setHighlightedMac] = useState(null);

  useEffect(() => {
    loadD3().then(setD3);
  }, []);

  useEffect(() => {
    const dispose = effect(() => {
      const state = openwrtState.value;
      const data = buildGraphData(state.connections || [], state.devices || []);
      setGraphData(data);
    });
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => {
      setHighlightedMac(selectedDeviceMac.value);
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (!d3 || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    d3.select(container).selectAll('svg').remove();

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svgRef.current = svg;

    const defs = svg.append('defs');

    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const highlightFilter = defs.append('filter')
      .attr('id', 'highlight-glow')
      .attr('x', '-100%')
      .attr('y', '-100%')
      .attr('width', '300%')
      .attr('height', '300%');

    highlightFilter.append('feGaussianBlur')
      .attr('stdDeviation', '6')
      .attr('result', 'coloredBlur');

    const highlightMerge = highlightFilter.append('feMerge');
    highlightMerge.append('feMergeNode').attr('in', 'coloredBlur');
    highlightMerge.append('feMergeNode').attr('in', 'coloredBlur');
    highlightMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const labelGroup = g.append('g').attr('class', 'labels');

    const padding = 60;
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(140).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d, false) + 25))
      .force('x', d3.forceX(width / 2).strength(0.08))
      .force('y', d3.forceY(height / 2).strength(0.08));

    simulationRef.current = { simulation, svg, g, linkGroup, nodeGroup, labelGroup, d3, width, height, padding, zoom };

  }, [d3]);

  useEffect(() => {
    if (!simulationRef.current || graphData.nodes.length === 0) {
      return;
    }

    const { simulation, linkGroup, nodeGroup, labelGroup, d3, width, height, padding } = simulationRef.current;

    const oldNodes = new Map(simulation.nodes().map(d => [d.id, d]));
    const nodes = graphData.nodes.map(d => ({ ...d, ...oldNodes.get(d.id) }));
    const links = graphData.links.map(d => ({ ...d }));

    const connectedToSelected = new Set();
    if (highlightedMac) {
      links.forEach(l => {
        if (l.srcMac === highlightedMac) {
          connectedToSelected.add(typeof l.target === 'object' ? l.target.id : l.target);
        }
      });
    }

    linkGroup.selectAll('line').remove();
    nodeGroup.selectAll('circle').remove();
    labelGroup.selectAll('text').remove();

    const link = linkGroup.selectAll('line')
      .data(links, d => d.id)
      .join('line')
      .attr('stroke', d => {
        if (highlightedMac && d.srcMac === highlightedMac) {
          return '#00ff88';
        }
        return '#ff8c00';
      })
      .attr('stroke-opacity', d => {
        if (highlightedMac) {
          return d.srcMac === highlightedMac ? 0.9 : 0.15;
        }
        return 0.5;
      })
      .attr('stroke-width', d => {
        if (highlightedMac && d.srcMac === highlightedMac) {
          return Math.min(3 + Math.log2(d.weight + 1) * 2, 8);
        }
        return Math.min(2 + Math.log2(d.weight + 1) * 1.5, 6);
      })
      .attr('filter', d => {
        if (highlightedMac && d.srcMac === highlightedMac) {
          return 'url(#highlight-glow)';
        }
        return 'url(#glow)';
      });

    const node = nodeGroup.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
      .attr('r', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return getNodeRadius(d, isSelected);
      })
      .attr('fill', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        const isConnectedToSelected = connectedToSelected.has(d.id);
        return getNodeColor(d, isSelected, isConnectedToSelected);
      })
      .attr('stroke', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return isSelected ? '#00ff88' : '#1a1a1a';
      })
      .attr('stroke-width', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return isSelected ? 4 : 2;
      })
      .attr('filter', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return isSelected ? 'url(#highlight-glow)' : 'url(#glow)';
      })
      .attr('opacity', d => {
        if (!highlightedMac) {
          return 1;
        }
        const isSelected = d.mac === highlightedMac;
        const isConnectedToSelected = connectedToSelected.has(d.id);
        return (isSelected || isConnectedToSelected) ? 1 : 0.3;
      })
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.type === 'device') {
          selectedDeviceMac.value = selectedDeviceMac.value === d.mac ? null : d.mac;
        }
        setSelectedNode(selectedNode?.id === d.id ? null : d);
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) {
            simulation.alphaTarget(0.3).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = Math.max(padding, Math.min(width - padding, event.x));
          d.fy = Math.max(padding, Math.min(height - padding, event.y));
        })
        .on('end', (event, d) => {
          if (!event.active) {
            simulation.alphaTarget(0);
          }
          d.fx = null;
          d.fy = null;
        }));

    const label = labelGroup.selectAll('text')
      .data(nodes.filter(d => d.type === 'device' || (d.connectionCount && d.connectionCount > 1)), d => d.id)
      .join('text')
      .attr('font-size', d => d.type === 'device' ? '13px' : '12px')
      .attr('fill', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return isSelected ? '#00ff88' : '#ff8c00';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d, highlightedMac && d.mac === highlightedMac) + 18)
      .attr('font-family', 'monospace')
      .attr('font-weight', d => {
        const isSelected = highlightedMac && d.mac === highlightedMac;
        return isSelected ? 'bold' : 'normal';
      })
      .attr('opacity', d => {
        if (!highlightedMac) {
          return 1;
        }
        const isSelected = d.mac === highlightedMac;
        const isConnectedToSelected = connectedToSelected.has(d.id);
        return (isSelected || isConnectedToSelected) ? 1 : 0.3;
      })
      .text(d => d.label);

    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(0.3).restart();

    simulation.on('tick', () => {
      nodes.forEach(d => {
        d.x = Math.max(padding, Math.min(width - padding, d.x));
        d.y = Math.max(padding, Math.min(height - padding, d.y));
      });

      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    });

  }, [graphData, highlightedMac]);

  const hasData = graphData.nodes.length > 0;

  const handleCloseDetails = () => {
    if (selectedNode?.type === 'device') {
      selectedDeviceMac.value = null;
    }
    setSelectedNode(null);
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  };

  const getDeviceStats = (mac) => {
    const deviceLinks = graphData.links.filter(l => l.srcMac === mac);
    const totalBytes = deviceLinks.reduce((sum, l) => sum + (l.bytes || 0), 0);
    const connectionCount = deviceLinks.length;
    const destinations = deviceLinks.map(l => {
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      const targetNode = graphData.nodes.find(n => n.id === targetId);
      return {
        name: targetNode?.label || 'Unknown',
        country: targetNode?.country,
        bytes: l.bytes || 0,
        weight: l.weight || 1
      };
    }).sort((a, b) => b.bytes - a.bytes).slice(0, 5);

    return { totalBytes, connectionCount, destinations };
  };

  const deviceStats = selectedNode?.type === 'device' ? getDeviceStats(selectedNode.mac) : null;

  return html`
    <div class="connection-graph-container">
      <div class="graph-wrapper" ref=${containerRef}>
        ${!hasData && html`
          <div class="graph-empty">
            <i data-lucide="share-2"></i>
            <span>Waiting for connection data...</span>
          </div>
        `}
      </div>
      ${selectedNode && html`
        <div class="node-details">
          <div class="node-details-header">
            <span class="node-type ${selectedNode.type}">${selectedNode.type.toUpperCase()}</span>
            <button class="close-btn" onClick=${handleCloseDetails}>x</button>
          </div>
          <div class="node-details-content">
            <div class="detail-row">
              <span class="label">Name:</span>
              <span class="value">${selectedNode.label}</span>
            </div>
            ${selectedNode.type === 'device' && html`
              <div class="detail-row">
                <span class="label">MAC:</span>
                <span class="value">${selectedNode.mac}</span>
              </div>
              <div class="detail-row">
                <span class="label">IP:</span>
                <span class="value">${selectedNode.ip}</span>
              </div>
              <div class="detail-row">
                <span class="label">Status:</span>
                <span class="value ${selectedNode.online ? 'online' : 'offline'}">
                  ${selectedNode.online ? 'Online' : 'Offline'}
                </span>
              </div>
              ${deviceStats && html`
                <div class="detail-section">
                  <div class="detail-section-title">Traffic</div>
                  <div class="detail-row">
                    <span class="label">Total:</span>
                    <span class="value">${formatBytes(deviceStats.totalBytes)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="label">Connections:</span>
                    <span class="value">${deviceStats.connectionCount}</span>
                  </div>
                </div>
                ${deviceStats.destinations.length > 0 && html`
                  <div class="detail-section">
                    <div class="detail-section-title">Top Destinations</div>
                    ${deviceStats.destinations.map(dest => html`
                      <div class="detail-row destination-row">
                        <span class="dest-name">
                          ${dest.country ? html`<span class="dest-country">${dest.country}</span>` : ''}
                          ${dest.name}
                        </span>
                        <span class="dest-bytes">${formatBytes(dest.bytes)}</span>
                      </div>
                    `)}
                  </div>
                `}
              `}
            `}
            ${selectedNode.type === 'external' && html`
              ${selectedNode.country && html`
                <div class="detail-row">
                  <span class="label">Country:</span>
                  <span class="value">${selectedNode.country}</span>
                </div>
              `}
              ${selectedNode.org && html`
                <div class="detail-row">
                  <span class="label">Organization:</span>
                  <span class="value">${selectedNode.org}</span>
                </div>
              `}
              <div class="detail-row">
                <span class="label">Connections:</span>
                <span class="value">${selectedNode.connectionCount || 0}</span>
              </div>
            `}
          </div>
        </div>
      `}
    </div>
  `;
}
