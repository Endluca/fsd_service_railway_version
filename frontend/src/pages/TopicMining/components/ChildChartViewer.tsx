import React, { useEffect, useRef } from 'react';
import { Card, Empty } from 'antd';
import * as d3 from 'd3';
import type { ChildStat } from '../../../types/topicmining';

interface ChildChartViewerProps {
  data?: ChildStat[];
  parentName: string;
}

// Ant Design 专业配色方案（与主饼图保持一致）
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

const ChildChartViewer: React.FC<ChildChartViewerProps> = ({ data, parentName }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // 清空之前的图表
    d3.select(chartRef.current).selectAll('*').remove();

    const width = 400;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 40;

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
      .pie<{ name: string; count: number; percentage: number; parentPercentage: number }>()
      .value((d) => d.count)
      .sort(null);

    // 弧生成器
    const arc = d3
      .arc<d3.PieArcDatum<{ name: string; count: number; percentage: number; parentPercentage: number }>>()
      .innerRadius(0)
      .outerRadius(radius);

    // 数据
    const chartData = data.map((child) => ({
      name: child.name,
      count: child.count,
      percentage: child.percentage,
      parentPercentage: child.parentPercentage,
    }));

    // 绘制饼图
    const arcs = svg
      .selectAll('.arc')
      .data(pie(chartData))
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
  }, [data]);

  // 如果没有数据，显示空状态
  if (!data || data.length === 0) {
    return (
      <Card title={`${parentName} - 二级类目分布`} size="small">
        <Empty description="暂无二级分类" />
      </Card>
    );
  }

  // 生成图例数据
  const legendData = data.map((child, index) => ({
    name: child.name,
    count: child.count,
    percentage: child.percentage,
    parentPercentage: child.parentPercentage,
    color: ANT_COLORS[index % ANT_COLORS.length],
  }));

  return (
    <Card title={`${parentName} - 二级类目分布`} size="small">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* 左侧：饼图 */}
        <div
          ref={chartRef}
          style={{
            flex: '0 0 50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 300,
          }}
        />

        {/* 右侧：传统图例 */}
        <div style={{ flex: '0 0 48%', paddingLeft: 12, paddingTop: 20 }}>
          {legendData.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: 10,
                fontSize: 12,
              }}
            >
              {/* 颜色块 */}
              <div
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: item.color,
                  marginRight: 6,
                  marginTop: 2,
                  flexShrink: 0,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              {/* 文字内容 */}
              <span style={{ lineHeight: '18px', wordBreak: 'break-word' }}>
                {item.name}
                <br />
                <span style={{ fontSize: 11, color: '#666' }}>
                  {item.count} 条 | 占父类 {item.percentage.toFixed(1)}% | 占总体{' '}
                  {item.parentPercentage.toFixed(1)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ChildChartViewer;
