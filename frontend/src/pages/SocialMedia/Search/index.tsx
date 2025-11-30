import React, { useState } from 'react';
import {
  Form,
  Input,
  Checkbox,
  InputNumber,
  Button,
  Switch,
  Card,
  Tabs,
  Table,
  message,
  Progress,
  Typography,
  Space,
  Tag,
  Image,
  Empty,
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { searchSocialMedia } from '../../../services/socialmedia';
import { saveSearchHistory } from '../../../services/socialmediaStorage';
import type {
  SearchFormData,
  SearchResult,
  SearchHistoryItem,
} from '../../../types/socialmedia';

const { TextArea } = Input;
const { Text } = Typography;

interface SearchProps {
  onSearchComplete?: () => void;
}

const Search: React.FC<SearchProps> = ({ onSearchComplete }) => {
  const [form] = Form.useForm<SearchFormData>();
  const [loading, setLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [showImages, setShowImages] = useState(true);

  // 执行搜索
  const handleSearch = async (values: SearchFormData) => {
    try {
      setLoading(true);
      setSearchResult(null);

      // 解析关键词
      const keywords = values.keywordsInput
        .replace(/，/g, ',')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      if (keywords.length === 0) {
        message.error('请至少输入一个关键词');
        return;
      }

      if (values.platforms.length === 0) {
        message.error('请至少选择一个平台');
        return;
      }

      // 调用 API
      const response = await searchSocialMedia(keywords, values.platforms, values.maxCount);

      if (response.code === 0 && response.data) {
        setSearchResult(response.data);
        message.success(`搜索完成！共获取 ${response.data.metadata.totalResults} 条结果`);

        // 保存到历史
        const historyItem: SearchHistoryItem = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          keywords,
          platforms: values.platforms,
          maxCount: values.maxCount,
          results: response.data,
          metadata: {
            totalResults: response.data.metadata.totalResults,
            duration: response.data.metadata.duration,
            status: response.data.metadata.errors.length === 0 ? 'success' : 'partial',
            errors: response.data.metadata.errors,
          },
        };
        await saveSearchHistory(historyItem);

        // 通知父组件刷新历史列表
        onSearchComplete?.();
      } else {
        message.error(response.message || '搜索失败');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 导出 Excel
  const handleExport = () => {
    if (!searchResult) return;

    const wb = XLSX.utils.book_new();

    // TikTok Sheet
    if (searchResult.tiktok.length > 0) {
      const ws = XLSX.utils.json_to_sheet(searchResult.tiktok);
      XLSX.utils.book_append_sheet(wb, ws, 'TikTok');
    }

    // Twitter Sheet
    if (searchResult.twitter.length > 0) {
      const ws = XLSX.utils.json_to_sheet(searchResult.twitter);
      XLSX.utils.book_append_sheet(wb, ws, 'Twitter');
    }

    // Instagram Sheet
    if (searchResult.instagram.length > 0) {
      const ws = XLSX.utils.json_to_sheet(searchResult.instagram);
      XLSX.utils.book_append_sheet(wb, ws, 'Instagram');
    }

    XLSX.writeFile(wb, `社媒搜索_${Date.now()}.xlsx`);
    message.success('导出成功');
  };

  // TikTok 表格列
  const tiktokColumns = [
    { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
    { title: '作者', dataIndex: 'author', key: 'author', width: 120 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '点赞数', dataIndex: 'diggs', key: 'diggs', width: 100 },
    {
      title: '封面',
      dataIndex: 'coverUrl',
      key: 'coverUrl',
      width: 100,
      render: (url: string) =>
        url && showImages ? <Image src={url} width={60} /> : url || '-',
    },
    {
      title: '视频链接',
      dataIndex: 'videoUrl',
      key: 'videoUrl',
      width: 100,
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            查看
          </a>
        ) : (
          '-'
        ),
    },
  ];

  // Twitter 表格列
  const twitterColumns = [
    { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
    { title: '用户', dataIndex: 'user', key: 'user', width: 120 },
    { title: '内容', dataIndex: 'text', key: 'text', ellipsis: true },
    { title: '发布时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
    {
      title: '链接',
      dataIndex: 'url',
      key: 'url',
      width: 80,
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            查看
          </a>
        ) : (
          '-'
        ),
    },
  ];

  // Instagram 表格列
  const instagramColumns = [
    { title: '关键词', dataIndex: 'keyword', key: 'keyword', width: 100 },
    { title: '标题', dataIndex: 'caption', key: 'caption', ellipsis: true },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 100,
      render: (url: string) =>
        url && showImages ? <Image src={url} width={60} /> : url || '-',
    },
    {
      title: '帖子链接',
      dataIndex: 'postUrl',
      key: 'postUrl',
      width: 100,
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            查看
          </a>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      {/* 搜索表单 */}
      <Card title="搜索设置" style={{ marginBottom: 24 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            keywordsInput: '51talk, vipkid, duolingo',
            platforms: ['tiktok', 'twitter', 'instagram'],
            maxCount: 3,
            showImages: true,
          }}
          onFinish={handleSearch}
        >
          <Form.Item
            name="keywordsInput"
            label="关键词（逗号分隔）"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <TextArea rows={2} placeholder="例如: 51talk, vipkid, duolingo" />
          </Form.Item>

          <Form.Item
            name="platforms"
            label="平台选择"
            rules={[{ required: true, message: '请至少选择一个平台' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                注意：Twitter 需要 Apify 付费账户；Instagram 免费版限制为每次约 2 条数据
              </Text>
            }
          >
            <Checkbox.Group
              options={[
                { label: 'TikTok', value: 'tiktok' },
                { label: 'Twitter (需付费)', value: 'twitter' },
                { label: 'Instagram (免费版限制)', value: 'instagram' },
              ]}
            />
          </Form.Item>

          <Space size="large">
            <Form.Item
              name="maxCount"
              label="每平台每关键词抓取数量"
              rules={[{ required: true, message: '请输入抓取数量' }]}
              extra={
                <Text type="warning" style={{ fontSize: 11 }}>
                  注意：TikTok 免费版实际抓取约 10-12 条（按实际抓取计费），系统会截断到您设置的数量
                </Text>
              }
            >
              <InputNumber min={1} max={20} />
            </Form.Item>

            <Form.Item label="显示图片/封面" valuePropName="checked">
              <Switch checked={showImages} onChange={setShowImages} />
            </Form.Item>
          </Space>

          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              开始搜索
            </Button>
          </Form.Item>
        </Form>

        {loading && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={100} status="active" showInfo={false} />
            <Text type="secondary">搜索中，请稍候...</Text>
          </div>
        )}
      </Card>

      {/* 搜索结果 */}
      {searchResult && (
        <Card
          title={
            <Space>
              <span>搜索结果</span>
              <Tag color="blue">共 {searchResult.metadata.totalResults} 条</Tag>
              {searchResult.metadata.errors.length > 0 && (
                <Tag color="warning">部分平台失败</Tag>
              )}
            </Space>
          }
          extra={
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
          }
        >
          <Tabs
            items={[
              {
                key: 'tiktok',
                label: `TikTok (${searchResult.tiktok.length})`,
                children: (
                  <Table
                    columns={tiktokColumns}
                    dataSource={searchResult.tiktok}
                    rowKey={(_, index) => `tiktok-${index}`}
                    pagination={{ pageSize: 10 }}
                  />
                ),
              },
              {
                key: 'twitter',
                label: `Twitter (${searchResult.twitter.length})`,
                children:
                  searchResult.twitter.length === 0 ? (
                    <Empty
                      description={
                        <Space direction="vertical">
                          <Text>Twitter 搜索未返回数据</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            可能原因：Apify 免费账户无法使用 Twitter Scraper，请升级为付费账户
                          </Text>
                        </Space>
                      }
                    />
                  ) : (
                    <Table
                      columns={twitterColumns}
                      dataSource={searchResult.twitter}
                      rowKey={(_, index) => `twitter-${index}`}
                      pagination={{ pageSize: 10 }}
                    />
                  ),
              },
              {
                key: 'instagram',
                label: `Instagram (${searchResult.instagram.length})`,
                children: (
                  <Table
                    columns={instagramColumns}
                    dataSource={searchResult.instagram}
                    rowKey={(_, index) => `instagram-${index}`}
                    pagination={{ pageSize: 10 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default Search;
