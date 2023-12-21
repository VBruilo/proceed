'use client';

import React, { useEffect, useState } from 'react';

import { PlusOutlined, CloseOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

import {
  Button,
  Divider,
  Drawer,
  Form,
  FormInstance,
  Grid,
  Input,
  Modal,
  Space,
  Table,
} from 'antd';
import { setProceedElement } from '@proceed/bpmn-helper';
import type { ElementLike } from 'diagram-js/lib/core/Types';
import Modeling from 'bpmn-js/lib/features/modeling/Modeling';
import useModelerStateStore from '@/lib/use-modeler-state-store';
import FormSubmitButton from './form-submit-button';
import { Editor } from '@toast-ui/react-editor';
import TextEditor from './text-editor';
import TextViewer from './text-viewer';

const MilestoneDescriptionEditor: React.FC<{
  onChange: (content: string) => void;
  initialValue?: string;
}> = ({ onChange, initialValue }) => {
  const editorRef = React.useRef<Editor>(null);

  useEffect(() => {
    if (editorRef.current && initialValue) {
      const editor = editorRef.current as Editor;
      const editorInstance = editor.getInstance();

      editorInstance.setMarkdown(initialValue);
    }
  }, [initialValue, editorRef]);

  return (
    <TextEditor
      ref={editorRef}
      placeholder="Milestone Description"
      initialValue={initialValue}
      onChange={() => {
        const editor = editorRef.current as Editor;
        const editorInstance = editor.getInstance();
        const content = editorInstance.getMarkdown();
        onChange(content);
      }}
    ></TextEditor>
  );
};

const MilestoneForm: React.FC<{
  form: FormInstance;
  initialValues?: { id: string; name: string; description?: string };
}> = ({ form, initialValues }) => {
  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  return (
    <Form form={form} name="name" className="milestone-form" initialValues={initialValues}>
      <Form.Item name="id" rules={[{ required: true, message: 'Please input the Milestone ID!' }]}>
        <Input placeholder="Milestone ID" />
      </Form.Item>
      <Form.Item
        name="name"
        rules={[{ required: true, message: 'Please input the Milestone Name!' }]}
      >
        <Input placeholder="Milestone Name" />
      </Form.Item>
      <Form.Item name="description" className="milestone-description">
        <MilestoneDescriptionEditor
          initialValue={initialValues?.description}
          onChange={(content) => {
            form.setFieldValue('description', content);
          }}
        ></MilestoneDescriptionEditor>
      </Form.Item>
    </Form>
  );
};

type MilestoneModalProperties = {
  show: boolean;
  close: (values?: { id: string; name: string; description?: string }) => void;
  initialValues?: { id: string; name: string; description?: string };
};

const MilestoneModal: React.FC<MilestoneModalProperties> = ({ show, close, initialValues }) => {
  const [form] = Form.useForm();

  return (
    <Modal
      title={initialValues ? 'Edit Milestone' : 'Create new Milestone'}
      width="50vw"
      open={show}
      onCancel={() => close()}
      footer={[
        <Button
          key="cancel"
          onClick={() => {
            close();
          }}
        >
          Cancel
        </Button>,
        <FormSubmitButton
          key="submit"
          form={form}
          onSubmit={close}
          submitText={initialValues ? 'Edit Milestone' : 'Create Milestone'}
        ></FormSubmitButton>,
      ]}
    >
      <MilestoneForm form={form} initialValues={initialValues}></MilestoneForm>
    </Modal>
  );
};

type MilestoneDrawerProperties = MilestoneModalProperties;
const MilestoneDrawer: React.FC<MilestoneDrawerProperties> = ({ show, close }) => {
  const [form] = Form.useForm();
  return (
    <Drawer
      className="milestone-drawer"
      open={show}
      width={'100vw'}
      styles={{ body: { marginBottom: '1rem', overflowY: 'hidden' } }}
      closeIcon={false}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Create new Milestone</span>
          <CloseOutlined onClick={() => close()}></CloseOutlined>
        </div>
      }
      footer={
        <Space style={{ display: 'flex', justifyContent: 'end' }}>
          <Button
            key="cancel"
            onClick={() => {
              close();
            }}
          >
            Cancel
          </Button>
          <FormSubmitButton
            key="submit"
            form={form}
            onSubmit={close}
            submitText="Create Milestone"
          ></FormSubmitButton>
        </Space>
      }
    >
      <MilestoneForm form={form}></MilestoneForm>
    </Drawer>
  );
};

type MilestoneSelectionProperties = {
  milestones: { id: string; name: string; description?: string }[];
  selectedElement: ElementLike;
};

const MilestoneSelection: React.FC<MilestoneSelectionProperties> = ({
  milestones,
  selectedElement,
}) => {
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [initialMilestoneValues, setInitialMilestoneValues] = useState<
    | {
        id: string;
        name: string;
        description?: string;
      }
    | undefined
  >(undefined);

  const modeler = useModelerStateStore((state) => state.modeler);

  const breakpoint = Grid.useBreakpoint();

  const closeMilestoneModal = () => {
    setInitialMilestoneValues(undefined);
    setIsMilestoneModalOpen(false);
  };

  const openMilestoneModal = (initialMilestoneValues: {
    id: string;
    name: string;
    description?: string;
  }) => {
    setInitialMilestoneValues(initialMilestoneValues);
    setIsMilestoneModalOpen(true);
  };

  const addMilestone = (newMilestone: { id: string; name: string; description?: string }) => {
    const modeling = modeler!.get('modeling') as Modeling;
    setProceedElement(selectedElement.businessObject, 'Milestone', undefined, newMilestone);
    modeling.updateProperties(selectedElement as any, {
      extensionElements: selectedElement.businessObject.extensionElements,
    });
  };

  const removeMilestone = (milestoneId: string) => {
    const modeling = modeler!.get('modeling') as Modeling;
    setProceedElement(selectedElement.businessObject, 'Milestone', null, {
      id: milestoneId,
    });
    modeling.updateProperties(selectedElement as any, {
      extensionElements: selectedElement.businessObject.extensionElements,
    });
  };

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Divider style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
          <span style={{ marginRight: '0.3em' }}>Milestones</span>
          <PlusOutlined
            onClick={() => {
              setIsMilestoneModalOpen(true);
            }}
          ></PlusOutlined>
        </Divider>
        <Table
          pagination={{ pageSize: 5 }}
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id' },
            { title: 'Name', dataIndex: 'name', key: 'name' },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (description) => {
                return <TextViewer initialValue={description}></TextViewer>;
              },
            },
            {
              title: '',
              dataIndex: 'edit',
              key: 'edit',
              render: (_, record) => (
                <Space size="small">
                  <EditOutlined
                    onClick={() => {
                      openMilestoneModal(record);
                    }}
                  />
                  <DeleteOutlined
                    onClick={() => {
                      removeMilestone(record.id);
                    }}
                  />
                </Space>
              ),
            },
          ]}
          dataSource={milestones}
        ></Table>
      </Space>
      {breakpoint.md ? (
        <MilestoneModal
          show={isMilestoneModalOpen}
          initialValues={initialMilestoneValues}
          close={(values) => {
            if (values) {
              if (initialMilestoneValues) {
                removeMilestone(initialMilestoneValues.id);
              }
              addMilestone(values);
            }

            closeMilestoneModal();
          }}
        ></MilestoneModal>
      ) : (
        <MilestoneDrawer
          show={isMilestoneModalOpen}
          close={(values) => {
            if (values) {
              if (initialMilestoneValues) {
                removeMilestone(initialMilestoneValues.id);
              }
              addMilestone(values);
            }

            closeMilestoneModal();
          }}
        ></MilestoneDrawer>
      )}
    </>
  );
};

export default MilestoneSelection;
