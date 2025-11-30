/**
 * 愤怒小鸟展示页面
 * 支持周多选、团队筛选、销售多选二次筛选、客户情绪统计
 */

import React, { useState, useEffect } from 'react';
import { Select, Radio, Button, Table, Spin, message, Space, Card, Row, Col, Statistic, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as angryBirdApi from '../../../services/angrybird';
import type { WeekItem, EmotionStat, AngryBirdDetail, Department } from '../../../types/angrybird';

const Display: React.FC = () => {
  const [weeks, setWeeks] = useState<WeekItem[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [department, setDepartment] = useState<Department>('');
  const [salesList, setSalesList] = useState<string[]>([]);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [emotionStats, setEmotionStats] = useState<EmotionStat[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [details, setDetails] = useState<AngryBirdDetail[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDetails, setTotalDetails] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWeeks();
  }, []);

  const loadWeeks = async () => {
    const res = await angryBirdApi.getWeekList();
    if (res.code === 0 && res.data) {
      setWeeks(res.data);
    }
  };

  const handleFirstQuery = async () => {
    if (!selectedWeeks.length) {
      message.warning('请选择时间范围');
      return;
    }

    setLoading(true);
    try {
      const weekStarts = selectedWeeks.map(w => w.split('~')[0]);
      const weekEnds = selectedWeeks.map(w => w.split('~')[1]);

      // 加载销售列表（用于二次筛选）
      const salesRes = await angryBirdApi.getSalesList(
        weekStarts,
        weekEnds,
        department || undefined
      );
      if (salesRes.code === 0 && salesRes.data) {
        setSalesList(salesRes.data);
      }

      // 加载情绪统计
      const statsRes = await angryBirdApi.getEmotionStats(
        weekStarts,
        weekEnds,
        department || undefined,
        undefined
      );
      if (statsRes.code === 0 && statsRes.data) {
        setEmotionStats(statsRes.data.stats);
        setTotalRecords(statsRes.data.totalRecords);
      }

      // 加载详情列表
      await loadDetails(weekStarts, weekEnds, 1);

      // 重置销售筛选
      setSelectedSales([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSecondQuery = async () => {
    const weekStarts = selectedWeeks.map(w => w.split('~')[0]);
    const weekEnds = selectedWeeks.map(w => w.split('~')[1]);

    setLoading(true);
    try {
      // 重新加载情绪统计（带销售筛选）
      const statsRes = await angryBirdApi.getEmotionStats(
        weekStarts,
        weekEnds,
        department || undefined,
        selectedSales.length > 0 ? selectedSales : undefined
      );
      if (statsRes.code === 0 && statsRes.data) {
        setEmotionStats(statsRes.data.stats);
        setTotalRecords(statsRes.data.totalRecords);
      }

      // 重新加载详情列表
      await loadDetails(weekStarts, weekEnds, 1);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (
    weekStarts: string[],
    weekEnds: string[],
    page: number
  ) => {
    const res = await angryBirdApi.getDetails(
      weekStarts,
      weekEnds,
      department || undefined,
      selectedSales.length > 0 ? selectedSales : undefined,
      page,
      10
    );

    if (res.code === 0 && res.data) {
      setDetails(res.data.details);
      setTotalDetails(res.data.total);
      setCurrentPage(page);
    }
  };

  const handlePageChange = (page: number) => {
    const weekStarts = selectedWeeks.map(w => w.split('~')[0]);
    const weekEnds = selectedWeeks.map(w => w.split('~')[1]);
    loadDetails(weekStarts, weekEnds, page);
  };

  const columns: ColumnsType<AngryBirdDetail> = [
    {
      title: '会话ID',
      dataIndex: 'conversationId',
      key: 'conversationId',
      width: 150,
    },
    {
      title: '会话开始时间',
      dataIndex: 'conversationStartTime',
      key: 'conversationStartTime',
      width: 170,
    },
    {
      title: '客户',
      dataIndex: 'customer',
      key: 'customer',
      width: 120,
    },
    {
      title: '销售',
      dataIndex: 'sales',
      key: 'sales',
      width: 120,
    },
    {
      title: '所属部门',
      dataIndex: 'originalDepartment',
      key: 'originalDepartment',
      width: 150,
    },
    {
      title: '客户情绪',
      dataIndex: 'customerEmotion',
      key: 'customerEmotion',
      width: 120,
    },
    {
      title: '原文',
      dataIndex: 'content',
      key: 'content',
      ellipsis: {
        showTitle: false,
      },
      render: (text: string | null) => (
        <Tooltip title={text || '（无）'} placement="topLeft">
          {text || '（无）'}
        </Tooltip>
      ),
    },
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
            onChange={(val) => {
              setSelectedWeeks(val);
              // 清空销售筛选
              setSelectedSales([]);
              setSalesList([]);
            }}
            options={weeks.map(w => ({
              label: `${w.weekStart} ~ ${w.weekEnd} (${w.recordCount}条)`,
              value: `${w.weekStart}~${w.weekEnd}`,
            }))}
          />
        </div>

        <div>
          <h4>选择团队</h4>
          <Radio.Group
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              // 清空销售筛选
              setSelectedSales([]);
              setSalesList([]);
            }}
          >
            <Radio value="">全部</Radio>
            <Radio value="cc">CC</Radio>
            <Radio value="ss">SS</Radio>
            <Radio value="lp">LP</Radio>
          </Radio.Group>
        </div>

        <Button type="primary" onClick={handleFirstQuery}>
          查询
        </Button>

        {salesList.length > 0 && (
          <div>
            <h4>选择销售（可选，支持多选）</h4>
            <Space>
              <Select
                mode="multiple"
                showSearch
                allowClear
                style={{ width: 400 }}
                placeholder="选择销售"
                value={selectedSales}
                onChange={setSelectedSales}
                options={salesList.map(s => ({ label: s, value: s }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
              <Button type="primary" onClick={handleSecondQuery}>
                按销售筛选
              </Button>
            </Space>
          </div>
        )}

        {emotionStats.length > 0 && (
          <>
            <div>
              <h4>客户情绪统计</h4>
              <Row gutter={[16, 16]}>
                {emotionStats.map(stat => (
                  <Col key={stat.emotion} xs={12} sm={8} md={6} lg={4}>
                    <Card>
                      <Statistic
                        title={stat.emotion}
                        value={stat.count}
                        suffix={`条 (${stat.percentage.toFixed(2)}%)`}
                      />
                    </Card>
                  </Col>
                ))}
                <Col xs={12} sm={8} md={6} lg={4}>
                  <Card>
                    <Statistic
                      title="总记录数"
                      value={totalRecords}
                      suffix="条"
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            <div>
              <h4>详情列表</h4>
              <Table
                columns={columns}
                dataSource={details}
                rowKey="conversationId"
                pagination={{
                  current: currentPage,
                  total: totalDetails,
                  pageSize: 10,
                  onChange: handlePageChange,
                  showSizeChanger: false,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
                scroll={{ x: 1000 }}
              />
            </div>
          </>
        )}
      </Space>
    </Spin>
  );
};

export default Display;
