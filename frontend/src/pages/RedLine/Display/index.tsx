import React, { useState, useEffect } from 'react';
import { Select, Radio, Button, Table, Spin, message, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as redlineApi from '../../../services/redline';
import type { WeekItem, RedLineTypeStat, RedLineDetail, Department } from '../../../types/redline';

const Display: React.FC = () => {
  const [weeks, setWeeks] = useState<WeekItem[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [department, setDepartment] = useState<Department>('');
  const [salesList, setSalesList] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string>('');
  const [stats, setStats] = useState<RedLineTypeStat[]>([]);
  const [totalViolations, setTotalViolations] = useState(0);
  const [totalConversations, setTotalConversations] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, { data: RedLineDetail[], page: number, total: number }>>({});

  useEffect(() => {
    loadWeeks();
  }, []);

  const loadWeeks = async () => {
    const res = await redlineApi.getWeekList();
    if (res.code === 0 && res.data) {
      setWeeks(res.data);
    }
  };

  const handleQuery = async () => {
    if (!selectedWeeks.length) {
      message.warning('请选择时间范围');
      return;
    }

    setLoading(true);
    try {
      const weekStarts = selectedWeeks.map(w => w.split('~')[0]);
      const weekEnds = selectedWeeks.map(w => w.split('~')[1]);

      // 加载销售列表
      const salesRes = await redlineApi.getSalesList(weekStarts, weekEnds, department || undefined);
      if (salesRes.code === 0 && salesRes.data) {
        setSalesList(salesRes.data);
      }

      // 加载统计
      const statsRes = await redlineApi.getStatistics(weekStarts, weekEnds, department || undefined, selectedSales || undefined);
      if (statsRes.code === 0 && statsRes.data) {
        setStats(statsRes.data.stats);
        setTotalViolations(statsRes.data.totalViolations);
        setTotalConversations(statsRes.data.totalConversations);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (redLineType: string, page: number = 1) => {
    const weekStarts = selectedWeeks.map(w => w.split('~')[0]);
    const weekEnds = selectedWeeks.map(w => w.split('~')[1]);

    const res = await redlineApi.getDetails(
      weekStarts,
      weekEnds,
      redLineType,
      department || undefined,
      selectedSales || undefined,
      page,
      10
    );

    if (res.code === 0 && res.data) {
      setDetailsMap(prev => ({
        ...prev,
        [redLineType]: { data: res.data!.details, page, total: res.data!.total }
      }));
    }
  };

  // 动态计算列配置，根据是否选择了销售来决定显示哪些列
  const columns: ColumnsType<RedLineTypeStat> = [
    { title: '红线类型', dataIndex: 'redLineType', key: 'redLineType' },
    { title: '违规数量', dataIndex: 'violationCount', key: 'violationCount' },
    { title: '占总红线数比', key: 'percentageOfTotal', render: (_, record) => `${record.percentageOfTotal.toFixed(2)}%` },
    { title: '总红线数', render: () => totalViolations },
    // 只有在未选择销售时才显示这两列
    ...(selectedSales ? [] : [
      { title: '占总会话比', key: 'percentageOfConversations', render: (_: any, record: RedLineTypeStat) => `${record.percentageOfConversations.toFixed(2)}%` },
      { title: '总会话数', render: () => totalConversations },
    ]),
  ];

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <h4>选择时间范围（可多选）</h4>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择周范围"
            value={selectedWeeks}
            onChange={setSelectedWeeks}
            options={weeks.map(w => ({
              label: `${w.weekStart} ~ ${w.weekEnd} (${w.recordCount}条)`,
              value: `${w.weekStart}~${w.weekEnd}`
            }))}
          />
        </div>

        <div>
          <h4>选择团队</h4>
          <Radio.Group value={department} onChange={e => setDepartment(e.target.value)}>
            <Radio value="">全部</Radio>
            <Radio value="cc">CC</Radio>
            <Radio value="ss">EA</Radio>
            <Radio value="lp">CM</Radio>
          </Radio.Group>
        </div>

        <div>
          <h4>选择销售（可选）</h4>
          <Select
            showSearch
            allowClear
            style={{ width: 300 }}
            placeholder="选择销售"
            value={selectedSales || undefined}
            onChange={(val) => setSelectedSales(val || '')}
            options={salesList.map(s => ({ label: s, value: s }))}
          />
        </div>

        <Button type="primary" onClick={handleQuery}>查询</Button>

        {stats.length > 0 && (
          <Table
            columns={columns}
            dataSource={stats}
            rowKey="redLineType"
            pagination={false}
            expandable={{
              expandedRowKeys,
              onExpand: (expanded, record) => {
                if (expanded) {
                  setExpandedRowKeys([...expandedRowKeys, record.redLineType]);
                  loadDetails(record.redLineType);
                } else {
                  setExpandedRowKeys(expandedRowKeys.filter(k => k !== record.redLineType));
                }
              },
              expandedRowRender: (record) => {
                const details = detailsMap[record.redLineType];
                if (!details) return <Spin />;

                return (
                  <Table
                    columns={[
                      { title: '会话ID', dataIndex: 'conversationId', key: 'conversationId' },
                      { title: '客户', dataIndex: 'customer', key: 'customer' },
                      { title: '销售', dataIndex: 'sales', key: 'sales' },
                      { title: '成员所属部门', dataIndex: 'originalDepartment', key: 'originalDepartment' },
                      { title: '原文', dataIndex: 'content', key: 'content', ellipsis: true },
                    ]}
                    dataSource={details.data}
                    rowKey="conversationId"
                    pagination={{
                      current: details.page,
                      total: details.total,
                      pageSize: 10,
                      onChange: (page) => loadDetails(record.redLineType, page),
                    }}
                  />
                );
              },
            }}
          />
        )}
      </Space>
    </Spin>
  );
};

export default Display;
