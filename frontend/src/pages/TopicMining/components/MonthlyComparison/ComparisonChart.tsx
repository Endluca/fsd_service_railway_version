import React from 'react';
import { Column } from '@ant-design/charts';
import type { ComparisonChartData } from '../../../../types/topicmining';

interface ComparisonChartProps {
  data: ComparisonChartData;
  yAxisLabel: string;
}

interface ColumnChartDataItem {
  category: string;
  value: number;
  month: string;
}

const ComparisonChart: React.FC<ComparisonChartProps> = ({
  data,
  yAxisLabel,
}) => {
  // 转换数据为图表格式
  const chartData = transformData(data);

  const config = {
    data: chartData,
    xField: 'category',      // X轴:类别名称
    yField: 'value',         // Y轴:占比值
    seriesField: 'month',    // 分组:月份
    isGroup: true,           // 启用分组柱状图

    columnStyle: {
      radius: [4, 4, 0, 0],  // 柱子圆角
    },

    label: {
      position: 'top' as const,
      style: {
        fill: '#000',
        opacity: 0.7,
        fontSize: 11,
      },
      formatter: (datum: any) => {
        if (datum.value === undefined || datum.value === null) return '';
        return `${datum.value.toFixed(1)}%`;
      },
    },

    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true,
        rotate: -45,
        offset: 10,
      },
      title: {
        text: '类别',
        style: { fontSize: 14 },
      },
    },

    yAxis: {
      label: {
        formatter: (v: string) => `${v}%`,
      },
      title: {
        text: yAxisLabel,
        style: { fontSize: 14 },
      },
    },

    legend: {
      position: 'bottom' as const,
      maxRow: 2,
      offsetY: 10,
    },

    color: generateMonthColors(data.months.length),

    interactions: [
      { type: 'legend-filter' },
      { type: 'element-highlight' },
    ],

    tooltip: {
      shared: true,
      showCrosshairs: true,
      formatter: (datum: any) => {
        return {
          name: datum.month,
          value: `${datum.value.toFixed(2)}%`,
        };
      },
    },

    // 处理大量类别的情况
    maxColumnWidth: 80,
    minColumnWidth: 20,
  };

  return <Column {...config} />;
};

/**
 * 数据转换函数
 * 将ComparisonChartData转换为@ant-design/charts需要的格式
 */
const transformData = (data: ComparisonChartData): ColumnChartDataItem[] => {
  const result: ColumnChartDataItem[] = [];

  data.categories.forEach((category) => {
    data.months.forEach((month) => {
      const item = data.series[month]?.[category];
      result.push({
        category,
        value: item?.percentage || 0,
        month: formatMonthForLegend(month),
      });
    });
  });

  return result;
};

/**
 * 生成月份颜色
 * 使用Ant Design标准配色 + HSL扩展
 */
const generateMonthColors = (count: number): string[] => {
  const baseColors = [
    '#1890ff',  // 拂晓蓝
    '#52c41a',  // 极光绿
    '#fa541c',  // 日暮红
    '#722ed1',  // 酱紫
    '#13c2c2',  // 明青
    '#eb2f96',  // 法式洋红
    '#faad14',  // 日暮黄
    '#2f54eb',  // 极客蓝
    '#a0d911',  // 新生绿
    '#f5222d',  // 薄暮红
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // 超过10个月份时,使用HSL扩展
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.5) % 360;  // 黄金角度分布
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};

/**
 * 格式化月份显示
 * YYYY-MM → YYYY年M月
 */
const formatMonthForLegend = (month: string): string => {
  const [year, m] = month.split('-');
  return `${year}年${parseInt(m)}月`;
};

export default ComparisonChart;
