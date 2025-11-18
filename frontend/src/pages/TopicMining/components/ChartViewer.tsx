import React, { useEffect, useRef } from 'react';
import { Card } from 'antd';
import * as d3 from 'd3';
import type { CsvAnalysisResult } from '../../../types/topicmining';

interface ChartViewerProps {
  statistics: CsvAnalysisResult;
}

// Ant Design 专业配色方案
const ANT_COLORS = [
  '#1890ff', // 拂晓蓝（主色）
  '#52c41a', // 极光绿
  '#faad14', // 日暮黄
  '#f5222d', // 薄暮红
  '#722ed1', // 酱紫
  '#13c2c2', // 明青
  '#eb2f96', // 法式洋红
  '#fa8c16', // 日出橙
  '#a0d911', // 新生绿
  '#2f54eb', // 极客蓝
];

const ChartViewer: React.FC<ChartViewerProps> = ({ statistics }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || statistics.parents.length === 0) return;

    // 清空之前的图表
    d3.select(chartRef.current).selectAll('*').remove();

    const width = 800;
    const height = 600;
    const radius = Math.min(width, height) / 2 - 60; // 增加边距以适应更大尺寸

    const svg = d3
      .select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // 使用 Ant Design 配色
    const color = d3.scaleOrdinal(ANT_COLORS);

    // 饼图生成器
    const pie = d3
      .pie<{ name: string; count: number; percentage: number }>()
      .value((d) => d.count)
      .sort(null);

    // 弧生成器
    const arc = d3
      .arc<d3.PieArcDatum<{ name: string; count: number; percentage: number }>>()
      .innerRadius(0)
      .outerRadius(radius);

    // 数据
    const data = statistics.parents.map((p) => ({
      name: p.name,
      count: p.count,
      percentage: p.percentage,
    }));

    // 绘制饼图
    const arcs = svg
      .selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (_d, i) => color(i.toString()))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .style('opacity', 0.8)
      .on('mouseover', function () {
        d3.select(this).style('opacity', 1);
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 0.8);
      });
  }, [statistics]);

  // 生成图例数据
  const legendData = statistics.parents.map((p, index) => ({
    name: p.name,
    count: p.count,
    percentage: p.percentage,
    color: ANT_COLORS[index % ANT_COLORS.length],
  }));

  return (
    <Card title="类目分布图" size="small">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 左侧：饼图 */}
        <div
          ref={chartRef}
          style={{
            flex: '0 0 70%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 600,
          }}
        />

        {/* 右侧：传统图例 */}
        <div style={{ flex: '0 0 28%', paddingLeft: 16, paddingTop: 40 }}>
          {legendData.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              {/* 颜色块 */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: item.color,
                  marginRight: 8,
                  flexShrink: 0,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              {/* 文字内容 */}
              <span style={{ lineHeight: '16px', wordBreak: 'break-word' }}>
                {item.name} ({item.count}, {item.percentage.toFixed(2)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ChartViewer;
