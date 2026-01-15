import React, { useState } from 'react';
import { Upload, Button, message, Alert } from 'antd';
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { parseCsvFile } from '../../../services/topicminingApi';
import type { CsvParseResult } from '../../../types/topicmining';

const { Dragger } = Upload;

interface CsvUploaderProps {
  onParseSuccess: (result: CsvParseResult, file: File) => void;
}

const CsvUploader: React.FC<CsvUploaderProps> = ({ onParseSuccess }) => {
  const [uploading, setUploading] = useState(false);

  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.csv,.xlsx,.xls',
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file) => {
      // 验证文件类型
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const isValidType = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      if (!isValidType) {
        message.error('只支持 CSV、XLSX 和 XLS 文件');
        return false;
      }

      // 验证文件大小（限制 150MB）
      const maxSize = 150 * 1024 * 1024;
      if (file.size > maxSize) {
        message.error('文件大小不能超过 150MB');
        return false;
      }

      setUploading(true);

      try {
        const result = await parseCsvFile(file);
        message.success('文件解析成功');
        onParseSuccess(result, file);
      } catch (error: any) {
        message.error(error.message || '文件解析失败');
      } finally {
        setUploading(false);
      }

      return false; // 阻止自动上传
    },
  };

  return (
    <div>
      <Alert
        message="上传说明"
        description="请上传包含话题挖掘数据的文件(支持 CSV、XLSX、XLS 格式)，文件大小不超过 150MB。文件应包含以下列：话题名称、所属父类、所属子类、上下文片段等。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Dragger {...uploadProps} disabled={uploading}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 CSV、Excel(.xlsx/.xls)格式，文件大小不超过 150MB
        </p>
      </Dragger>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Upload {...uploadProps} disabled={uploading}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            {uploading ? '解析中...' : '选择文件'}
          </Button>
        </Upload>
      </div>
    </div>
  );
};

export default CsvUploader;
