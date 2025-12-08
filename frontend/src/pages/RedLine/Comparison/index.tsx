import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Checkbox,
  Button,
  Radio,
  Space,
  Spin,
  message,
  Row,
  Col,
  Empty,
} from 'antd';
import { Column } from '@ant-design/charts';
import type {
  WeekItem,
  ComparisonTrendResult,
  ColumnChartDataItem,
} from '../../../types/redline';
import * as redlineApi from '../../../services/redline';

const Comparison: React.FC = () => {
  // ========== 状态管理 ==========
  const [weeks, setWeeks] = useState<WeekItem[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([
    'cc',
    'ss',
    'lp',
  ]);
  const [redLineTypes, setRedLineTypes] = useState<string[]>([]);
  const [selectedRedLineTypes, setSelectedRedLineTypes] = useState<string[]>(
    []
  );
  const [trendData, setTrendData] = useState<ComparisonTrendResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [showMode, setShowMode] = useState<'percentage' | 'count'>(
    'percentage'
  );

  // ========== 生命周期 ==========
  useEffect(() => {
    loadWeeks();
  }, []);

  useEffect(() => {
    if (selectedWeeks.length > 0) {
      loadRedLineTypes();
    } else {
      setRedLineTypes([]);
      setSelectedRedLineTypes([]);
    }
  }, [selectedWeeks]);

  // ========== 数据加载 ==========
  const loadWeeks = async () => {
    try {
      const res = await redlineApi.getWeekList();
      if (res.code === 0 && res.data) {
        setWeeks(
          res.data.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        );
      }
    } catch (error) {
      message.error('加载周列表失败');
    }
  };

  const loadRedLineTypes = async () => {
    try {
      const weekStarts = selectedWeeks.map((w) => w.split('~')[0]);
      const weekEnds = selectedWeeks.map((w) => w.split('~')[1]);

      const res = await redlineApi.getStatistics(weekStarts, weekEnds);
      if (res.code === 0 && res.data) {
        const types = res.data.stats.map((s) => s.redLineType);
        setRedLineTypes(types);
        setSelectedRedLineTypes(types); // 默认全选
      }
    } catch (error) {
      message.error('加载红线类型失败');
    }
  };

  const handleQuery = async () => {
    if (selectedWeeks.length === 0) {
      message.warning('请至少选择一个周');
      return;
    }

    setLoading(true);
    try {
      const weekStarts = selectedWeeks.map((w) => w.split('~')[0]);
      const weekEnds = selectedWeeks.map((w) => w.split('~')[1]);

      const res = await redlineApi.getComparisonTrend(
        weekStarts,
        weekEnds,
        selectedDepartments.length > 0 ? selectedDepartments : undefined,
        selectedRedLineTypes.length > 0 ? selectedRedLineTypes : undefined
      );

      if (res.code === 0 && res.data) {
        console.log('对比趋势数据:', res.data);
        setTrendData(res.data);
      } else {
        message.error(res.message || '查询失败');
      }
    } catch (error) {
      console.error('查询失败:', error);
      message.error('查询失败');
    } finally {
      setLoading(false);
    }
  };

  // ========== 数据转换 ==========
  const transformOverallTrendData = (): ColumnChartDataItem[] => {
    if (!trendData) return [];
    const result: ColumnChartDataItem[] = [];
    const departmentsToShow = ['all', ...selectedDepartments];

    trendData.overallTrend.weeks.forEach((week, index) => {
      departmentsToShow.forEach((dept) => {
        if (trendData.overallTrend.series[dept]) {
          const value = trendData.overallTrend.series[dept].ratios[index];
          if (value !== undefined && value !== null) {
            result.push({
              category: formatWeekForChart(week),
              value: value,
              type: getDepartmentLabel(dept),
            });
          }
        }
      });
    });

    console.log('视图1转换后数据:', result);
    return result;
  };

  const transformRedLineTrendData = (): ColumnChartDataItem[] => {
    if (!trendData) return [];
    const result: ColumnChartDataItem[] = [];

    trendData.redLineTrend.redLineTypes.forEach((redLineType) => {
      trendData.redLineTrend.weeks.forEach((week) => {
        const item = trendData.redLineTrend.series[week]?.[redLineType];
        if (item) {
          const value = showMode === 'percentage' ? item.percentage : item.count;
          if (value !== undefined && value !== null) {
            result.push({
              category: redLineType,
              value: value,
              type: formatWeekForChart(week),
            });
          }
        }
      });
    });

    console.log('视图2转换后数据:', result);
    return result;
  };

  // ========== 辅助函数 ==========
  const formatWeekDisplay = (start: string, end: string): string => {
    return `${start.slice(5).replace('-', '月')}日 至 ${end
      .slice(5)
      .replace('-', '月')}日`;
  };

  const formatWeekForChart = (week: string): string => {
    const [start, end] = week.split('~');
    return `${start.slice(5)} 至 ${end.slice(5)}`;
  };

  const getDepartmentLabel = (dept: string): string => {
    const labels: Record<string, string> = {
      all: '所有部门',
      cc: 'CC',
      ss: 'EA',
      lp: 'CM',
    };
    return labels[dept] || dept;
  };

  const generateWeekColors = (count: number): string[] => {
    const baseColors = [
      '#1890ff',
      '#52c41a',
      '#fa541c',
      '#722ed1',
      '#13c2c2',
      '#eb2f96',
      '#faad14',
      '#2f54eb',
      '#a0d911',
      '#f5222d',
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    const colors = [...baseColors];
    for (let i = baseColors.length; i < count; i++) {
      const hue = (i * 137.5) % 360;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
  };

  // ========== 图表配置 ==========
  const overallChartConfig = {
    data: transformOverallTrendData(),
    xField: 'category',
    yField: 'value',
    seriesField: 'type',
    colorField: 'type',
    isGroup: true,

    appendPadding: [10, 0, 0, 0],

    columnStyle: {
      radius: [4, 4, 0, 0],
    },

    label: {
      position: 'top' as const,
      offset: 4,
      autoHide: false,
      layout: [
        { type: 'interval-adjust-position' },
        { type: 'interval-hide-overlap' },
        { type: 'adjust-color' },
      ],
      style: {
        fill: '#000',
        opacity: 1,
        fontSize: 12,
        fontWeight: 'bold',
      },
      content: (datum: any) => {
        if (datum.value === undefined || datum.value === null) return '';
        return `${datum.value.toFixed(2)}%`;
      },
    },

    meta: {
      category: {
        alias: '时间周期',
      },
      value: {
        alias: '红线占总会话数的比例 (%)',
        formatter: (v: number) => `${v}%`,
      },
    },

    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false,
      },
      title: {
        text: '时间周期',
        position: 'center',
        style: {
          fontSize: 14,
        },
      },
    },

    yAxis: {
      label: {
        formatter: (v: string) => `${v}%`,
      },
      title: {
        text: '红线占总会话数的比例 (%)',
        position: 'center',
        style: {
          fontSize: 14,
        },
      },
    },

    legend: {
      position: 'bottom' as const,
      offsetY: 10,
    },

    color: ['#8c8c8c', '#1890ff', '#52c41a', '#fa541c'],

    interactions: [
      { type: 'legend-filter' },
      { type: 'element-highlight' },
    ],

    tooltip: {
      shared: true,
      showCrosshairs: true,
    },
  };

  const redLineChartConfig = {
    data: transformRedLineTrendData(),
    xField: 'category',
    yField: 'value',
    seriesField: 'type',
    colorField: 'type',
    isGroup: true,

    appendPadding: [10, 0, 0, 0],

    columnStyle: {
      radius: [4, 4, 0, 0],
    },

    label: {
      position: 'top' as const,
      offset: 4,
      autoHide: false,
      layout: [
        { type: 'interval-adjust-position' },
        { type: 'interval-hide-overlap' },
        { type: 'adjust-color' },
      ],
      style: {
        fill: '#000',
        opacity: 1,
        fontSize: 11,
        fontWeight: 'bold',
      },
      content: (datum: any) => {
        if (datum.value === undefined || datum.value === null) return '';
        return showMode === 'percentage'
          ? `${datum.value.toFixed(1)}%`
          : String(datum.value);
      },
    },

    meta: {
      category: {
        alias: '红线违规类型',
      },
      value: {
        alias: showMode === 'percentage' ? '占当周总红线比例 (%)' : '违规次数 (次)',
        formatter: (v: number) => (showMode === 'percentage' ? `${v}%` : String(v)),
      },
    },

    xAxis: {
      label: {
        autoHide: true,
        autoRotate: true,
        rotate: -45,
        offset: 10,
      },
      title: {
        text: '红线违规类型',
        position: 'center',
        style: {
          fontSize: 14,
        },
      },
    },

    yAxis: {
      label: {
        formatter: (v: string) => (showMode === 'percentage' ? `${v}%` : v),
      },
      title: {
        text: showMode === 'percentage' ? '占当周总红线比例 (%)' : '违规次数 (次)',
        position: 'center',
        style: {
          fontSize: 14,
        },
      },
    },

    legend: {
      position: 'bottom' as const,
      maxRow: 2,
      offsetY: 10,
    },

    color: trendData
      ? generateWeekColors(trendData.redLineTrend.weeks.length)
      : [],

    interactions: [
      { type: 'legend-filter' },
      { type: 'element-highlight' },
    ],

    tooltip: {
      shared: true,
      showCrosshairs: true,
    },
  };

  // ========== 渲染 ==========
  return (
    <div style={{ padding: '24px' }}>
      {/* 筛选器卡片 */}
      <Card title="筛选条件" style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 周范围选择器 */}
          <div>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
              选择周范围：
            </div>
            <Checkbox.Group
              value={selectedWeeks}
              onChange={setSelectedWeeks}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 16]}>
                {weeks.map((w) => {
                  const weekKey = `${w.weekStart}~${w.weekEnd}`;
                  return (
                    <Col span={6} key={weekKey}>
                      <Checkbox value={weekKey}>
                        {formatWeekDisplay(w.weekStart, w.weekEnd)} (
                        {w.recordCount}条)
                      </Checkbox>
                    </Col>
                  );
                })}
              </Row>
            </Checkbox.Group>
          </div>

          {/* 部门和红线类型筛选器 */}
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                选择部门：
              </div>
              <Select
                mode="multiple"
                value={selectedDepartments}
                onChange={setSelectedDepartments}
                style={{ width: '100%' }}
                placeholder="选择部门（默认全部）"
                options={[
                  { label: 'CC部门', value: 'cc' },
                  { label: 'EA部门', value: 'ss' },
                  { label: 'CM部门', value: 'lp' },
                ]}
                maxTagCount="responsive"
              />
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                选择红线类型：
              </div>
              <Select
                mode="multiple"
                value={selectedRedLineTypes}
                onChange={setSelectedRedLineTypes}
                style={{ width: '100%' }}
                placeholder="选择红线类型（默认全部）"
                options={redLineTypes.map((t) => ({ label: t, value: t }))}
                maxTagCount="responsive"
                disabled={redLineTypes.length === 0}
              />
            </Col>
          </Row>

          {/* 查询按钮 */}
          <Button
            type="primary"
            onClick={handleQuery}
            loading={loading}
            disabled={selectedWeeks.length === 0}
          >
            查询
          </Button>
        </Space>
      </Card>

      {/* 图表区域 */}
      <Spin spinning={loading}>
        {trendData ? (
          <>
            {/* 视图1：总红线趋势 */}
            <Card
              title="总红线趋势（红线占总会话数的比例）"
              style={{ marginBottom: 24 }}
            >
              <div style={{ position: 'relative', paddingLeft: 50, paddingBottom: 10 }}>
                {/* Y轴标题 */}
                <div
                  style={{
                    position: 'absolute',
                    left: -30,
                    top: '50%',
                    transform: 'translateY(-50%) rotate(-90deg)',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#000',
                    whiteSpace: 'nowrap',
                  }}
                >
                  红线占总会话数的比例 (%)
                </div>

                {/* 图表 */}
                <Column {...overallChartConfig} height={400} />

                {/* X轴标题 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#000',
                  }}
                >
                  时间周期
                </div>
              </div>
            </Card>

            {/* 视图2：各红线趋势 */}
            <Card
              title="各红线趋势"
              extra={
                <Radio.Group
                  value={showMode}
                  onChange={(e) => setShowMode(e.target.value)}
                  buttonStyle="solid"
                >
                  <Radio.Button value="percentage">百分比</Radio.Button>
                  <Radio.Button value="count">绝对数量</Radio.Button>
                </Radio.Group>
              }
            >
              <div style={{ position: 'relative', paddingLeft: 50, paddingBottom: 10 }}>
                {/* Y轴标题 */}
                <div
                  style={{
                    position: 'absolute',
                    left: -20,
                    top: '50%',
                    transform: 'translateY(-50%) rotate(-90deg)',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#000',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showMode === 'percentage' ? '占当周总红线比例 (%)' : '违规次数 (次)'}
                </div>

                {/* 图表 */}
                <Column {...redLineChartConfig} height={400} />

                {/* X轴标题 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#000',
                  }}
                >
                  红线违规类型
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <Empty description="请选择筛选条件并点击查询按钮" />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default Comparison;
