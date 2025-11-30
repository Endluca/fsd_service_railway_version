import React, { useState, useEffect } from 'react';
import { List, Card, Button, Space, Tag, Modal, Tabs, Table, Empty, message } from 'antd';
import { EyeOutlined, DownloadOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import {
  getSearchHistory,
  deleteSearchHistory,
  clearAllHistory,
} from '../../../services/socialmediaStorage';
import type { SearchHistoryItem } from '../../../types/socialmedia';

const { confirm } = Modal;

interface HistoryProps {
  refreshTrigger?: number;
}

const History: React.FC<HistoryProps> = ({ refreshTrigger }) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingItem, setViewingItem] = useState<SearchHistoryItem | null>(null);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      setLoading(true);
      const items = await getSearchHistory();
      setHistory(items);
    } catch (error) {
      console.error('加载历史失败:', error);
      message.error('加载历史失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [refreshTrigger]);

  // 删除单条记录
  const handleDelete = (id: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条搜索记录吗？',
      onOk: async () => {
        try {
          await deleteSearchHistory(id);
          await loadHistory();
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // 清空所有历史
  const handleClearAll = () => {
    confirm({
      title: '确认清空',
      icon: <ExclamationCircleOutlined />,
      content: '确定要清空所有搜索历史吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await clearAllHistory();
          await loadHistory();
          message.success('清空成功');
        } catch (error) {
          message.error('清空失败');
        }
      },
    });
  };

  // 导出单条记录
  const handleExport = (item: SearchHistoryItem) => {
    const wb = XLSX.utils.book_new();

    if (item.results.tiktok.length > 0) {
      const ws = XLSX.utils.json_to_sheet(item.results.tiktok);
      XLSX.utils.book_append_sheet(wb, ws, 'TikTok');
    }

    if (item.results.twitter.length > 0) {
      const ws = XLSX.utils.json_to_sheet(item.results.twitter);
      XLSX.utils.book_append_sheet(wb, ws, 'Twitter');
    }

    if (item.results.instagram.length > 0) {
      const ws = XLSX.utils.json_to_sheet(item.results.instagram);
      XLSX.utils.book_append_sheet(wb, ws, 'Instagram');
    }

    XLSX.writeFile(wb, `社媒搜索_${dayjs(item.timestamp).format('YYYYMMDDHHmmss')}.xlsx`);
    message.success('导出成功');
  };

  return (
    <div>
      <Card
        title={`搜索历史 (${history.length} 条)`}
        extra={
          <Button danger onClick={handleClearAll} disabled={history.length === 0}>
            清空全部
          </Button>
        }
      >
        {history.length === 0 ? (
          <Empty description="暂无搜索历史" />
        ) : (
          <List
            loading={loading}
            dataSource={history}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => setViewingItem(item)}
                  >
                    查看
                  </Button>,
                  <Button
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={() => handleExport(item)}
                  >
                    导出
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item.id)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss')}</span>
                      <Tag color={item.metadata.status === 'success' ? 'success' : 'warning'}>
                        {item.metadata.status === 'success' ? '成功' : '部分失败'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <div>
                        关键词: {item.keywords.join(', ')}
                      </div>
                      <div>
                        平台:{' '}
                        {item.platforms.map((p) => (
                          <Tag key={p}>{p.toUpperCase()}</Tag>
                        ))}
                      </div>
                      <div>
                        结果数: {item.metadata.totalResults} 条 | 耗时:{' '}
                        {(item.metadata.duration / 1000).toFixed(2)} 秒
                      </div>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 查看详情 Modal */}
      <Modal
        title="搜索结果详情"
        open={viewingItem !== null}
        onCancel={() => setViewingItem(null)}
        width={1000}
        footer={[
          <Button key="export" icon={<DownloadOutlined />} onClick={() => viewingItem && handleExport(viewingItem)}>
            导出
          </Button>,
          <Button key="close" onClick={() => setViewingItem(null)}>
            关闭
          </Button>,
        ]}
      >
        {viewingItem && (
          <Tabs
            items={[
              {
                key: 'tiktok',
                label: `TikTok (${viewingItem.results.tiktok.length})`,
                children: (
                  <Table
                    columns={[
                      { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
                      { title: '作者', dataIndex: 'author', key: 'author', width: 120 },
                      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
                      { title: '点赞数', dataIndex: 'diggs', key: 'diggs', width: 100 },
                    ]}
                    dataSource={viewingItem.results.tiktok}
                    rowKey={(_, index) => `tiktok-${index}`}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'twitter',
                label: `Twitter (${viewingItem.results.twitter.length})`,
                children: (
                  <Table
                    columns={[
                      { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
                      { title: '用户', dataIndex: 'user', key: 'user', width: 120 },
                      { title: '内容', dataIndex: 'text', key: 'text', ellipsis: true },
                    ]}
                    dataSource={viewingItem.results.twitter}
                    rowKey={(_, index) => `twitter-${index}`}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ),
              },
              {
                key: 'instagram',
                label: `Instagram (${viewingItem.results.instagram.length})`,
                children: (
                  <Table
                    columns={[
                      { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
                      { title: '标题', dataIndex: 'caption', key: 'caption', ellipsis: true },
                    ]}
                    dataSource={viewingItem.results.instagram}
                    rowKey={(_, index) => `instagram-${index}`}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default History;
