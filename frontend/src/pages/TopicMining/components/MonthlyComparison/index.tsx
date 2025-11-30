import React, { useState, useEffect } from 'react';
import { Card, Spin, Empty, message } from 'antd';
import FilterPanel from './FilterPanel';
import ComparisonChart from './ComparisonChart';
import * as topicMiningApi from '../../../../services/topicminingApi';
import type { MonthInfo, ComparisonResult } from '../../../../types/topicmining';

const MonthlyComparison: React.FC = () => {
  // ========== 状态管理 ==========
  const [loading, setLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<MonthInfo[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [parentTopN, setParentTopN] = useState(3);
  const [childTopN, setChildTopN] = useState(5);
  const [comparisonData, setComparisonData] = useState<ComparisonResult | null>(null);

  // ========== 生命周期 ==========
  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // ========== 数据加载 ==========
  const loadAvailableMonths = async () => {
    try {
      const result = await topicMiningApi.getAvailableMonths();
      setAvailableMonths(result.months);
    } catch (error) {
      message.error('加载月份列表失败');
      console.error('加载月份列表失败:', error);
    }
  };

  const handleQuery = async () => {
    if (selectedMonths.length === 0) {
      message.warning('请至少选择一个月份');
      return;
    }

    setLoading(true);
    try {
      const data = await topicMiningApi.getMonthlyComparison(
        selectedMonths,
        parentTopN,
        childTopN
      );
      setComparisonData(data);
    } catch (error) {
      message.error('查询对比数据失败');
      console.error('查询对比数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== 渲染 ==========
  return (
    <div style={{ padding: '24px' }}>
      {/* 筛选器面板 */}
      <FilterPanel
        availableMonths={availableMonths}
        selectedMonths={selectedMonths}
        onMonthsChange={setSelectedMonths}
        parentTopN={parentTopN}
        onParentTopNChange={setParentTopN}
        childTopN={childTopN}
        onChildTopNChange={setChildTopN}
        onQuery={handleQuery}
        loading={loading}
      />

      {/* 图表展示区域 */}
      <Spin spinning={loading}>
        {comparisonData ? (
          <>
            {/* 父类对比图表 */}
            <Card title="父类话题月度对比" style={{ marginTop: 24 }}>
              {comparisonData.parentComparison.categories.length > 0 ? (
                <ComparisonChart
                  data={comparisonData.parentComparison}
                  yAxisLabel="占比 (%)"
                />
              ) : (
                <Empty description="暂无父类数据" />
              )}
            </Card>

            {/* 子类对比图表 */}
            <Card title="子类话题月度对比" style={{ marginTop: 24 }}>
              {comparisonData.childComparison.categories.length > 0 ? (
                <ComparisonChart
                  data={comparisonData.childComparison}
                  yAxisLabel="占比 (%)"
                />
              ) : (
                <Empty description="暂无子类数据" />
              )}
            </Card>
          </>
        ) : (
          <Card style={{ marginTop: 24 }}>
            <Empty description="请选择月份并点击查询" />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default MonthlyComparison;
