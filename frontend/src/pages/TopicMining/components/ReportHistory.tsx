import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Popconfirm } from 'antd';
import { EyeOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getReports, deleteReport } from '../../../services/topicminingApi';
import type { ReportListItem } from '../../../types/topicmining';

interface ReportHistoryProps {
  onViewReport?: (reportId: string) => void;
  refreshTrigger?: number;
}

const ReportHistory: React.FC<ReportHistoryProps> = ({ onViewReport, refreshTrigger }) => {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await getReports();
      setReports(data);
    } catch (error: any) {
      message.error(error.message || '加载报告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  const handleDelete = async (id: string) => {
    try {
      await deleteReport(id);
      message.success('报告删除成功');
      loadReports();
    } catch (error: any) {
      message.error(error.message || '报告删除失败');
    }
  };

  const columns: ColumnsType<ReportListItem> = [
    {
      title: '报告标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      key: 'generatedAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => dayjs(a.generatedAt).unix() - dayjs(b.generatedAt).unix(),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      defaultSortOrder: 'descend',
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewReport?.(record.id)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个报告吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="报告历史"
      size="small"
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadReports}
          loading={loading}
        >
          刷新
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        size="small"
      />
    </Card>
  );
};

export default ReportHistory;
