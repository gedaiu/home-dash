import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useRef, useState } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState } from '../state.js';

let d3Promise = null;

function loadD3() {
  if (!d3Promise) {
    d3Promise = import('https://esm.sh/d3@7.8.5');
  }
  return d3Promise;
}

function getNodeColor(node) {
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

function getNodeRadius(node) {
  if (node.type === 'device') {
    return 8;
  }
  const connections = node.connectionCount || 1;
  return Math.min(6 + Math.log2(connections + 1) * 3, 16);
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
    const srcId = `device:${conn.srcMac}`;
    const dstId = `external:${conn.dstOrg || conn.dstCountry || conn.dstIp}`;

    if (!nodeMap.has(srcId)) {
      nodeMap.set(srcId, {
        id: srcId,
        type: 'device',
        label: conn.srcMac?.substring(0, 8) || 'Unknown',
        mac: conn.srcMac,
        ip: conn.srcIp,
        online: true
      });
    }

    if (!nodeMap.has(dstId)) {
      nodeMap.set(dstId, {
        id: dstId,
        type: 'external',
        label: conn.dstOrg || conn.dstCountry || conn.dstIp,
        country: conn.dstCountry,
        org: conn.dstOrg,
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
        protocol: conn.protocol
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
    if (!d3 || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

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
      .attr('stdDeviation', '2')
      .attr('result', 'coloredBlur');

    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const labelGroup = g.append('g').attr('class', 'labels');

    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 10));

    simulationRef.current = { simulation, svg, g, linkGroup, nodeGroup, labelGroup, d3, width, height };

  }, [d3]);

  useEffect(() => {
    if (!simulationRef.current || graphData.nodes.length === 0) {
      return;
    }

    const { simulation, g, linkGroup, nodeGroup, labelGroup, d3, width, height } = simulationRef.current;

    const oldNodes = new Map(simulation.nodes().map(d => [d.id, d]));
    const nodes = graphData.nodes.map(d => ({ ...d, ...oldNodes.get(d.id) }));
    const links = graphData.links.map(d => ({ ...d }));

    linkGroup.selectAll('line').remove();
    nodeGroup.selectAll('circle').remove();
    labelGroup.selectAll('text').remove();

    const link = linkGroup.selectAll('line')
      .data(links, d => d.id)
      .join('line')
      .attr('stroke', '#ff8c00')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => Math.min(1 + Math.log2(d.weight + 1), 4))
      .attr('filter', 'url(#glow)');

    const node = nodeGroup.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 1.5)
      .attr('filter', 'url(#glow)')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
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
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) {
            simulation.alphaTarget(0);
          }
          d.fx = null;
          d.fy = null;
        }));

    const label = labelGroup.selectAll('text')
      .data(nodes.filter(d => d.type === 'device' || (d.connectionCount && d.connectionCount > 2)), d => d.id)
      .join('text')
      .attr('font-size', '10px')
      .attr('fill', '#ff8c00')
      .attr('text-anchor', 'middle')
      .attr('dy', d => getNodeRadius(d) + 12)
      .attr('font-family', 'monospace')
      .text(d => d.label);

    simulation.nodes(nodes);
    simulation.force('link').links(links);
    simulation.alpha(0.3).restart();

    simulation.on('tick', () => {
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

  }, [graphData, selectedNode]);

  const hasData = graphData.nodes.length > 0;

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
            <button class="close-btn" onClick=${() => setSelectedNode(null)}>x</button>
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
