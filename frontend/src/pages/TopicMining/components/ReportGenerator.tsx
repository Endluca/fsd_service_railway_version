import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, InputNumber, Collapse, DatePicker } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { createReport } from '../../../services/topicminingApi';
import type { CsvAnalysisResult, SampleSnippet } from '../../../types/topicmining';
import SnippetViewer from './SnippetViewer';
import type { Dayjs } from 'dayjs';

const { Panel } = Collapse;
const { RangePicker } = DatePicker;

const { TextArea } = Input;

interface ReportGeneratorProps {
  statistics: CsvAnalysisResult;
  fileName?: string;
  onReportCreated?: (reportId: string) => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  statistics,
  fileName,
  onReportCreated,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [maxSnippetsPerChild, setMaxSnippetsPerChild] = useState(0);

  // 记录选中的片段：{ parentName: { childName: [snippetIndex1, snippetIndex2, ...] } }
  const [selectedSnippets, setSelectedSnippets] = useState<
    Record<string, Record<string, number[]>>
  >({});

  // 当片段数量变化时，自动选中前N个片段
  useEffect(() => {
    if (maxSnippetsPerChild === 0) {
      setSelectedSnippets({});
      return;
    }

    const newSelectedSnippets: Record<string, Record<string, number[]>> = {};

    statistics.parents.forEach((parent) => {
      const children = parent.children || [];
      newSelectedSnippets[parent.name] = {};

      children.forEach((child) => {
        const snippets = statistics.childSamples?.[parent.name]?.[child.name] || [];
        const count = Math.min(maxSnippetsPerChild, snippets.length);

        // 自动选中前N个
        newSelectedSnippets[parent.name][child.name] = Array.from(
          { length: count },
          (_, i) => i
        );
      });
    });

    setSelectedSnippets(newSelectedSnippets);
  }, [maxSnippetsPerChild, statistics]);

  // 处理片段选中/取消选中
  const handleSnippetSelection = (
    parentName: string,
    childName: string,
    snippetIndex: number,
    selected: boolean
  ) => {
    setSelectedSnippets((prev) => {
      const newState = { ...prev };

      if (!newState[parentName]) {
        newState[parentName] = {};
      }

      if (!newState[parentName][childName]) {
        newState[parentName][childName] = [];
      }

      if (selected) {
        // 添加选中的片段索引
        if (!newState[parentName][childName].includes(snippetIndex)) {
          newState[parentName][childName] = [
            ...newState[parentName][childName],
            snippetIndex,
          ];
        }
      } else {
        // 移除取消选中的片段索引
        newState[parentName][childName] = newState[parentName][childName].filter(
          (idx) => idx !== snippetIndex
        );
      }

      return newState;
    });
  };

  const handleSubmit = async (values: {
    title: string;
    summary?: string;
    totalSessions?: number;
    timeRange?: [Dayjs, Dayjs];
  }) => {
    setLoading(true);

    try {
      // 构建selectedSamples
      const selectedSamples: {
        parentSamples: Record<string, SampleSnippet[]>;
        childSamples: Record<string, Record<string, SampleSnippet[]>>;
      } = {
        parentSamples: {},
        childSamples: {},
      };

      // 遍历selectedSnippets，提取实际的snippet对象
      Object.entries(selectedSnippets).forEach(([parentName, children]) => {
        selectedSamples.childSamples[parentName] = {};

        Object.entries(children).forEach(([childName, indices]) => {
          const allSnippets = statistics.childSamples?.[parentName]?.[childName] || [];
          const selected = indices
            .map((idx) => allSnippets[idx])
            .filter((s) => s !== undefined);

          if (selected.length > 0) {
            selectedSamples.childSamples[parentName][childName] = selected;
          }
        });
      });

      const result = await createReport({
        title: values.title,
        summary: values.summary,
        statistics,
        selectedSamples,
        metadata: {
          sourceFileName: fileName,
          sourceUploadedAt: new Date().toISOString(),
          totalSessions: values.totalSessions,
          timeRange: values.timeRange
            ? {
                start: values.timeRange[0].format('YYYY-MM-DD'),
                end: values.timeRange[1].format('YYYY-MM-DD'),
              }
            : undefined,
        },
      });

      message.success('报告创建成功');
      form.resetFields();
      setMaxSnippetsPerChild(0);
      setSelectedSnippets({});
      onReportCreated?.(result.id);
    } catch (error: any) {
      message.error(error.message || '报告创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="生成报告" size="small">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          title: fileName ? `${fileName} - 话题挖掘报告` : '话题挖掘报告',
        }}
      >
        <Form.Item
          label="报告标题"
          name="title"
          rules={[{ required: true, message: '请输入报告标题' }]}
        >
          <Input placeholder="请输入报告标题" maxLength={255} />
        </Form.Item>

        <Form.Item label="报告摘要" name="summary">
          <TextArea
            placeholder="请输入报告摘要（可选）"
            rows={4}
            maxLength={1000}
            showCount
          />
        </Form.Item>

        {/* 报告总会话数 */}
        <Form.Item label="报告总会话数" name="totalSessions">
          <InputNumber
            min={0}
            placeholder="请输入总会话数（可选）"
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* 报告时间范围 */}
        <Form.Item label="报告时间范围" name="timeRange">
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>

        {/* 片段数量选择器 */}
        <Form.Item label="报告中展示的上下文片段数量">
          <InputNumber
            min={0}
            max={10}
            value={maxSnippetsPerChild}
            onChange={(value) => setMaxSnippetsPerChild(value || 0)}
            style={{ width: '100%' }}
            placeholder="选择每个二级类目显示的片段数量（0-10）"
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            选择数量后，可在下方选中您想要在报告中展示的片段
          </div>
        </Form.Item>

        {/* 片段选择区域 */}
        {maxSnippetsPerChild > 0 && (
          <Form.Item label="选择要展示的上下文片段">
            <div
              style={{
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                padding: '16px',
                maxHeight: '600px',
                overflowY: 'auto',
              }}
            >
              <Collapse>
                {statistics.parents.map((parent) => {
                  const children = parent.children || [];
                  return (
                    <Panel header={`${parent.name} (${children.length} 个子类)`} key={parent.name}>
                      <Collapse>
                        {children.map((child) => {
                          const snippets =
                            statistics.childSamples?.[parent.name]?.[child.name] || [];
                          const displaySnippets = snippets.slice(0, 10); // 始终显示前10个片段
                          const selectedIndices =
                            selectedSnippets?.[parent.name]?.[child.name] || [];

                          return (
                            <Panel
                              header={`${child.name} (${snippets.length} 个片段)`}
                              key={child.name}
                            >
                              {displaySnippets.length > 0 ? (
                                displaySnippets.map((snippet, index) => (
                                  <SnippetViewer
                                    key={index}
                                    snippet={snippet}
                                    snippetIndex={index}
                                    showSelection={true}
                                    selected={selectedIndices.includes(index)}
                                    onSelectionChange={(idx, selected) =>
                                      handleSnippetSelection(
                                        parent.name,
                                        child.name,
                                        idx,
                                        selected
                                      )
                                    }
                                  />
                                ))
                              ) : (
                                <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                                  该类目暂无上下文片段
                                </div>
                              )}
                            </Panel>
                          );
                        })}
                      </Collapse>
                    </Panel>
                  );
                })}
              </Collapse>
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={loading}
            block
          >
            保存报告
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ReportGenerator;
