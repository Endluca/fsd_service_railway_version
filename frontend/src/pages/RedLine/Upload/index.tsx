import React, { useState } from 'react';
import { Upload as AntUpload, Button, DatePicker, message, Modal, Space } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import * as redlineApi from '../../../services/redline';

const { Dragger } = AntUpload;

const Upload: React.FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null); // 保存实际的File对象
  const [weekStart, setWeekStart] = useState<string>('');
  const [weekEnd, setWeekEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 验证日期范围是否是完整的一周（周一到周日）
  const validateWeekRange = (start: Dayjs, end: Dayjs): boolean => {
    // 检查开始日期是周一 (1)
    if (start.day() !== 1) {
      message.error('开始日期必须是周一');
      return false;
    }

    // 检查结束日期是周日 (0)
    if (end.day() !== 0) {
      message.error('结束日期必须是周日');
      return false;
    }

    // 检查相差是否正好 6 天
    const diff = end.diff(start, 'day');
    if (diff !== 6) {
      message.error('必须选择完整的一周（起止日期相差6天）');
      return false;
    }

    return true;
  };

  // 日期范围选择处理
  const onDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const start = dates[0];
      const end = dates[1];

      // 验证是否是完整的一周
      if (validateWeekRange(start, end)) {
        setWeekStart(start.format('YYYY-MM-DD'));
        setWeekEnd(end.format('YYYY-MM-DD'));
      } else {
        // 验证失败，清空状态
        setWeekStart('');
        setWeekEnd('');
      }
    } else {
      // 清空选择
      setWeekStart('');
      setWeekEnd('');
    }
  };

  const handleUpload = async (replace: boolean = false) => {
    if (!currentFile) {
      message.error('请选择文件');
      return;
    }
    if (!weekStart || !weekEnd) {
      message.error('请选择时间范围');
      return;
    }

    setLoading(true);
    try {
      const result = await redlineApi.uploadFile(currentFile, weekStart, weekEnd, replace);

      // 添加防御性检查
      if (!result) {
        message.error('服务器响应异常，请稍后重试');
        console.error('Upload result is undefined');
        return;
      }

      console.log('Upload result:', result); // 调试日志

      if (result.code === 0) {
        message.success(result.message || '导入成功');
        setFileList([]);
        setCurrentFile(null);
      } else if (result.code === 2) {
        // 需要确认覆盖
        Modal.confirm({
          title: '该周已有数据',
          content: `已存在 ${result.data?.recordCount} 条记录，是否覆盖？`,
          onOk: () => handleUpload(true),
        });
      } else {
        if (result.data?.errors) {
          // 显示详细错误
          const errorLines = result.data.errors.map(e =>
            `第${e.row}行 ${e.field}: ${e.reason}`
          ).slice(0, 10).join('\n');
          Modal.error({
            title: '数据错误',
            content: <pre style={{ maxHeight: '400px', overflow: 'auto' }}>{errorLines}</pre>,
            width: 700,
          });
        } else {
          message.error(result.message || '上传失败');
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        request: error.request,
      });

      // 更详细的错误处理
      if (error.response) {
        // 服务器返回了错误响应
        const errorMsg = error.response.data?.message || error.response.statusText || '服务器错误';
        message.error(`上传失败: ${errorMsg}`);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        message.error('网络错误，请检查服务器是否正常运行');
      } else {
        // 其他错误
        message.error(error.message || '上传失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <h4>选择时间范围（必须是完整的一周：周一到周日）</h4>
          <DatePicker.RangePicker
            onChange={onDateRangeChange}
            format="YYYY-MM-DD"
            style={{ width: 400 }}
            placeholder={['开始日期（周一）', '结束日期（周日）']}
          />
          <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
            示例：2025-11-10（周一）至 2025-11-16（周日）
          </div>
          {weekStart && weekEnd && (
            <div style={{ marginTop: 8, color: '#52c41a', fontWeight: 'bold' }}>
              ✓ 已选择：{weekStart} 至 {weekEnd}
            </div>
          )}
        </div>

        <div>
          <h4>上传Excel文件</h4>
          <Dragger
            fileList={fileList}
            beforeUpload={(file) => {
              // 验证文件类型
              const isXlsx = file.name.endsWith('.xlsx');
              if (!isXlsx) {
                message.error('只能上传 .xlsx 格式的文件！');
                return false;
              }

              // 保存实际的File对象和显示用的UploadFile对象
              setCurrentFile(file);
              setFileList([{
                uid: file.uid,
                name: file.name,
                status: 'done',
                size: file.size,
                type: file.type,
              } as UploadFile]);

              return false; // 阻止自动上传
            }}
            onRemove={() => {
              setFileList([]);
              setCurrentFile(null);
            }}
            maxCount={1}
            accept=".xlsx"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">仅支持 .xlsx 格式文件，必需列：会话ID、客户、销售、成员所属部门、红线类型、原文</p>
          </Dragger>
        </div>

        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => handleUpload(false)}
          loading={loading}
          disabled={!currentFile || !weekStart}
        >
          上传并导入
        </Button>
      </Space>
    </div>
  );
};

export default Upload;
