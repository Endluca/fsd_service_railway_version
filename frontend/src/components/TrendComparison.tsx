import React, { useState, useEffect, useRef } from 'react';
import {
  Space,
  Radio,
  DatePicker,
  Select,
  Button,
  message,
  Typography,
  Card,
  Spin,
} from 'antd';
import { Line } from '@ant-design/charts';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type {
  MetricType,
  DateRange,
  TrendQueryParams,
} from '../types';
import { getTrendData, getTrendDateRange, getGroups, getSales } from '../services/api';
import { useTrendStore } from '../stores/useTrendStore';

dayjs.extend(isoWeek);

const { Text } = Typography;
const { RangePicker } = DatePicker;

// 指标选项
const metricOptions = [
  { label: '及时回复率（%）', value: 'timelyReplyRate' },
  { label: '超时回复率（%）', value: 'overtimeReplyRate' },
  { label: '平均回复时长（分钟）', value: 'avgReplyDuration' },
  { label: '会话数', value: 'conversationCount' },
];

// 生成高对比度颜色方案
const generateColors = (count: number): string[] => {
  const baseColors = [
    '#1890ff', // 蓝色
    '#52c41a', // 绿色
    '#fa541c', // 橙色
    '#722ed1', // 紫色
    '#13c2c2', // 青色
    '#eb2f96', // 粉色
    '#faad14', // 金色
    '#2f54eb', // 深蓝
    '#a0d911', // 黄绿
    '#f5222d', // 红色
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // 如果需要更多颜色，生成更多颜色
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.5) % 360; // 黄金角度分布
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
};

const TrendComparison: React.FC = () => {
  console.log('=== TrendComparison component rendering ===');

  // 从store获取状态和actions
  const {
    comparisonType,
    granularity,
    metric,
    dateRange,
    selectedGroups,
    selectedPersons,
    trendData,
    setComparisonType,
    setGranularity,
    setMetric,
    setDateRange,
    setSelectedGroups,
    setSelectedPersons,
    setTrendData,
  } = useTrendStore();

  // 本地状态（不需要持久化的状态）
  const [loading, setLoading] = useState(false);
  const [availableDateRange, setAvailableDateRange] = useState<DateRange | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [allSalesPeople, setAllSalesPeople] = useState<{ openUserId: string; name: string; groupName: string | null }[]>([]);
  // const [annotations, setAnnotations] = useState<any[]>([]); // 暂时禁用 annotations
  const isInitialMountRef = useRef(true);
  const chartRef = useRef<any>(null);

  // 加载初始数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 加载可用日期范围
      const dateRangeData = await getTrendDateRange();
      if (dateRangeData) {
        setAvailableDateRange(dateRangeData);
        // 只在没有保存的日期范围时，设置默认日期范围为最近7天
        if (!dateRange) {
          const end = dayjs(dateRangeData.endDate);
          const start = end.subtract(6, 'day');
          setDateRange([start, end]);
        }
      }

      // 加载小组列表
      const groupsData = await getGroups();
      setGroups(groupsData);

      // 标记初始挂载完成
      isInitialMountRef.current = false;
    } catch (error) {
      console.error('加载初始数据失败:', error);
      message.error('加载初始数据失败');
    }
  };

  // 加载销售人员列表（组内人员对比时）
  const loadSalesPeople = async () => {
    if (!dateRange) return;
    try {
      const [start, end] = dateRange;
      const sales = await getSales(
        undefined,
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD')
      );
      setAllSalesPeople(sales);
    } catch (error) {
      console.error('加载销售人员列表失败:', error);
      message.error('加载销售人员列表失败');
    }
  };

  // 当对比类型为person且有日期范围时，加载人员列表
  useEffect(() => {
    if (comparisonType === 'person' && dateRange) {
      loadSalesPeople();
    }
  }, [comparisonType, dateRange]);

  // 当对比类型改变时（不是初始挂载时），重置相关数据
  useEffect(() => {
    if (isInitialMountRef.current) return; // 跳过初始挂载

    if (comparisonType !== 'group') {
      setSelectedGroups([]);
    }
    if (comparisonType !== 'person') {
      setSelectedPersons([]);
    }
    setTrendData(null);
  }, [comparisonType]);

  // 查询数据
  const handleQuery = async () => {
    if (!dateRange) {
      message.warning('请选择时间范围');
      return;
    }

    // 组内人员对比时必须选择人员
    if (comparisonType === 'person' && selectedPersons.length === 0) {
      message.warning('请至少选择一个人员');
      return;
    }

    // 周粒度校验
    if (granularity === 'week') {
      const [start, end] = dateRange;
      if (start.isoWeekday() !== 1) {
        message.warning('周粒度时，开始日期必须是周一');
        return;
      }
      if (end.isoWeekday() !== 7) {
        message.warning('周粒度时，结束日期必须是周日');
        return;
      }
    }

    setLoading(true);
    try {
      const params: TrendQueryParams = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        granularity,
        comparisonType,
        metric,
      };

      // 根据对比类型添加过滤参数
      if (comparisonType === 'group' && selectedGroups.length > 0) {
        params.groupNames = selectedGroups;
      } else if (comparisonType === 'person') {
        params.openUserIds = selectedPersons;
      }

      const data = await getTrendData(params);
      setTrendData(data);

      if (data.series.length === 0) {
        message.info('暂无数据');
      }
    } catch (error: any) {
      console.error('查询失败:', error);
      message.error(error.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理人员选择（带全选功能）
  const handlePersonsChange = (values: string[]) => {
    if (values.includes('__ALL__')) {
      // 点击全选：如果已全选则清空，否则全选
      if (selectedPersons.length === allSalesPeople.length) {
        setSelectedPersons([]);
      } else {
        setSelectedPersons(allSalesPeople.map(p => p.openUserId));
      }
    } else {
      setSelectedPersons(values);
    }
  };

  // 生成分组人员选项
  const generatePersonOptions = (salesPeople: { openUserId: string; name: string; groupName: string | null }[]) => {
    const groupMap = new Map<string, { openUserId: string; name: string; groupName: string | null }[]>();

    salesPeople.forEach(person => {
      const group = person.groupName || '未分配';
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(person);
    });

    return Array.from(groupMap.entries()).map(([groupName, persons]) => ({
      label: groupName,
      options: persons.map(p => ({
        label: `${p.name} (${p.groupName || '未分配'})`,
        value: p.openUserId,
      })),
    }));
  };

  // 禁用不可选的日期
  const disabledDate = (current: Dayjs) => {
    if (!availableDateRange) return false;

    const minDate = dayjs(availableDateRange.startDate);
    const maxDate = dayjs(availableDateRange.endDate);

    return current.isBefore(minDate, 'day') || current.isAfter(maxDate, 'day');
  };

  // 获取指标单位（暂时禁用，与 annotations 功能一起使用）
  /*
  const getMetricUnit = (metricType: MetricType): string => {
    switch (metricType) {
      case 'timelyReplyRate':
      case 'overtimeReplyRate':
        return '%';
      case 'avgReplyDuration':
        return '分钟';
      case 'conversationCount':
        return '个';
      default:
        return '';
    }
  };
  */

  // 获取指标名称
  const getMetricName = (metricType: MetricType): string => {
    const option = metricOptions.find(opt => opt.value === metricType);
    return option ? option.label : metricType;
  };

  // 暂时禁用 annotations 功能
  /*
  const updateChartAnnotations = useCallback((hoveredLine: string | null, hoveredDate: string | null) => {
    console.log('=== updateChartAnnotations called ===');
    console.log('Hovered Line:', hoveredLine);
    console.log('Hovered Date:', hoveredDate);

    if (!trendData) {
      setAnnotations([]);
      return;
    }

    const newAnnotations: any[] = [];
    const unit = getMetricUnit(metric);

    // 1. 添加悬浮折线的所有节点标签（蓝色）
    if (hoveredLine) {
      trendData.series
        .filter(d => d.name === hoveredLine)
        .forEach(d => {
          newAnnotations.push({
            type: 'text',
            position: [d.date, d.value],
            content: `${d.value.toFixed(2)}${unit}`,
            style: {
              fill: '#1890ff',
              fontSize: 12,
              fontWeight: 'bold',
              textAlign: 'center',
              textBaseline: 'bottom',
            },
            offsetY: -15,
          });
        });
    }

    // 2. 添加悬浮日期的所有节点标签（红色）
    // 避免重复：如果某个节点已经因为悬浮折线而添加，则跳过
    if (hoveredDate) {
      trendData.series
        .filter(d => d.date === hoveredDate && d.name !== hoveredLine)
        .forEach(d => {
          newAnnotations.push({
            type: 'text',
            position: [d.date, d.value],
            content: `${d.value.toFixed(2)}${unit}`,
            style: {
              fill: '#f5222d',
              fontSize: 12,
              fontWeight: 'bold',
              textAlign: 'center',
              textBaseline: 'bottom',
            },
            offsetY: -15,
          });
        });
    }

    console.log('New annotations count:', newAnnotations.length);
    console.log('New annotations:', newAnnotations);
    setAnnotations(newAnnotations);
  }, [trendData, metric]);
  */

  // 准备图表配置
  const getChartConfig = () => {
    if (!trendData || trendData.series.length === 0) return null;

    const colors = generateColors(trendData.lines.length);

    return {
      data: trendData.series,
      xField: 'date',
      yField: 'value',
      colorField: 'name',  // v2 使用 colorField 而不是 seriesField
      smooth: true,
      animation: {
        appear: {
          animation: 'path-in',
          duration: 1000,
        },
      },
      // 暂时禁用 annotations 配置
      // annotations: annotations,
      // v2 颜色配置
      scale: {
        color: {
          range: colors,
        },
      },
      // 点配置 - 颜色自动继承折线颜色
      point: {
        size: 5,
        shape: 'circle',
        style: {
          fill: 'white',
          lineWidth: 2,
        },
      },
      // 折线样式
      lineStyle: {
        lineWidth: 2,
      },
      // 自定义tooltip - 显示横向数据
      tooltip: {
        showCrosshairs: true,
        shared: true,
        // 使用 itemSorter 来排序 tooltip 项目（按数值从大到小）
        itemSorter: (a: any, b: any) => {
          console.log('=== itemSorter called ===');
          console.log('Item A:', a);
          console.log('Item B:', b);

          // 获取数值进行比较
          const aValue = typeof a.value === 'number' ? a.value : parseFloat(a.value) || 0;
          const bValue = typeof b.value === 'number' ? b.value : parseFloat(b.value) || 0;

          console.log(`Comparing: ${a.name} (${aValue}) vs ${b.name} (${bValue})`);

          // 降序排序（从大到小）
          return bValue - aValue;
        },
      },
      // 图例配置 - v2 嵌套在 color 下
      legend: {
        color: {
          position: 'right',
          layout: 'vertical',
          offsetX: -10,
          flipPage: true,
          itemName: {
            style: {
              fontSize: 14,
            },
          },
        },
      },
      xAxis: {
        label: {
          autoHide: true,
          autoRotate: false,
        },
        title: {
          text: granularity === 'day' ? '日期' : '周',
          style: {
            fontSize: 14,
          },
        },
      },
      yAxis: {
        title: {
          text: getMetricName(metric),
          style: {
            fontSize: 14,
          },
        },
      },
      // 交互配置
      interactions: [
        { type: 'tooltip' },           // 启用 tooltip 交互
        { type: 'legend-filter' },     // 点击图例切换折线显示/隐藏
        { type: 'element-highlight' }, // 鼠标悬停高亮折线
      ],
      // 暂时禁用图表事件监听（annotations 相关）
      onReady: ({ chart }: any) => {
        chartRef.current = chart;
        console.log('Chart ready, but annotations are disabled');
      },
    };
  };

  const chartConfig = getChartConfig();

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 筛选区域 */}
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 对比层级选择 */}
          <Space wrap>
            <Text strong>对比层级:</Text>
            <Radio.Group
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value)}
            >
              <Radio.Button value="all">整体对比</Radio.Button>
              <Radio.Button value="group">组间对比</Radio.Button>
              <Radio.Button value="person">组内人员对比</Radio.Button>
            </Radio.Group>
          </Space>

          {/* 时间颗粒度选择 */}
          <Space wrap>
            <Text strong>时间颗粒度:</Text>
            <Radio.Group
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
            >
              <Radio.Button value="day">日</Radio.Button>
              <Radio.Button value="week">周</Radio.Button>
            </Radio.Group>
            {granularity === 'week' && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                （周粒度需选择完整周：周一至周日）
              </Text>
            )}
          </Space>

          {/* 时间范围和指标选择 */}
          <Space wrap>
            <Space>
              <Text strong>时间范围:</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
                format="YYYY-MM-DD"
                disabledDate={disabledDate}
              />
            </Space>

            <Space>
              <Text strong>指标:</Text>
              <Select
                value={metric}
                onChange={setMetric}
                style={{ width: 180 }}
                options={metricOptions}
              />
            </Space>

            <Button type="primary" onClick={handleQuery} loading={loading}>
              查询
            </Button>
          </Space>

          {/* 组间对比：组选择器 */}
          {comparisonType === 'group' && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Text strong>选择小组:</Text>
                <Select
                  mode="multiple"
                  value={selectedGroups}
                  onChange={setSelectedGroups}
                  placeholder="请选择小组（留空则对比全部）"
                  style={{ minWidth: 300 }}
                  maxTagCount="responsive"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                >
                  {groups.map(g => (
                    <Select.Option key={g} value={g}>{g}</Select.Option>
                  ))}
                </Select>
              </Space>
              {selectedGroups.length > 0 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已选择 {selectedGroups.length} 个小组
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  未选择小组，将对比所有小组
                </Text>
              )}
            </Space>
          )}

          {/* 组内人员对比：人员选择器 */}
          {comparisonType === 'person' && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <Text strong>选择人员:</Text>
                <Select
                  mode="multiple"
                  value={selectedPersons}
                  onChange={handlePersonsChange}
                  placeholder="请选择人员（可跨组选择）"
                  style={{ minWidth: 400 }}
                  maxTagCount="responsive"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={allSalesPeople.length === 0}
                >
                  <Select.Option value="__ALL__">全选</Select.Option>
                  {generatePersonOptions(allSalesPeople).map(group => (
                    <Select.OptGroup key={group.label} label={group.label}>
                      {group.options.map(opt => (
                        <Select.Option key={opt.value} value={opt.value}>
                          {opt.label}
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Space>
              {selectedPersons.length > 0 && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已选择 {selectedPersons.length} 个人员
                </Text>
              )}
            </Space>
          )}
        </Space>

        {/* 图表区域 */}
        <div style={{ marginTop: '32px', minHeight: '400px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" tip="加载中...">
                <div style={{ minHeight: 200 }} />
              </Spin>
            </div>
          ) : chartConfig ? (
            <Line {...chartConfig} />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '100px 0',
                color: '#999',
                fontSize: '16px',
              }}
            >
              请选择筛选条件并点击"查询"按钮查看趋势图
            </div>
          )}
        </div>

        {/* 说明 */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: '1.8',
            color: '#666',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
            使用说明：
          </div>
          <div>• 全部人对比：展示整体整体指标随时间变化的趋势</div>
          <div>• 组对比：对比不同小组的指标趋势，每条线代表一个小组</div>
          <div>• 人对比：对比同一小组内不同人员的指标趋势，需先选择小组</div>
          <div>• 周粒度：必须选择完整周（周一到周日），数据按周聚合计算</div>
        </div>
      </Card>
    </div>
  );
};

export default TrendComparison;
