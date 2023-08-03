'use client';

import styles from './processes.module.scss';
import { FC, useState } from 'react';
import { Dropdown, MenuProps, Row, Table, TableColumnsType, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchProcesses } from '@/lib/fetch-data';
import { useRouter } from 'next/navigation';
import {
  EllipsisOutlined,
  EditOutlined,
  CopyOutlined,
  ExportOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Processes } from '@/lib/fetch-data';
import { TableRowSelection } from 'antd/es/table/interface';

// const [rowSelection, setRowSelection] = useState<TableRowSelection<DataType> | undefined>({});

const actionBar = (
  <>
    <Row justify="space-evenly">
      <Tooltip placement="top" title={'Edit Meta Information'}>
        <EditOutlined />
      </Tooltip>
      <Tooltip placement="top" title={'Copy'}>
        <CopyOutlined />
      </Tooltip>
      <Tooltip placement="top" title={'Export'}>
        <ExportOutlined />
      </Tooltip>
      <Tooltip placement="top" title={'Delete'}>
        <DeleteOutlined />
      </Tooltip>
    </Row>
  </>
);

const Processes: FC = () => {
  const [selection, setSelection] = useState<Processes>([]);

  // rowSelection object indicates the need for row selection
  const rowSelection = {
    onChange: (selectedRowKeys: React.Key[], selectedRows: Processes) => {
      console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
    },
    getCheckboxProps: (record: Processes[number]) => ({
      name: record.definitionId,
    }),
    onSelect: (record, selected, selectedRows, nativeEvent) => {
      console.log(`Select: ${selected}, \n Record: ${record}`);
      setSelection(selectedRows);
    },
    onSelectNone: () => {
      setSelection([]);
    },
    onSelectAll: (selected, selectedRows, changeRows) => {
      console.log(`Select: ${selected}, \n Selected Rows: ${selectedRows}`);
      setSelection(selectedRows);
    },
  };

  // const processActions: MenuProps['items'] = [
  //   {
  //     key: '1',
  //     label: 'Edit Metadata',
  //   },
  //   {
  //     key: '2',
  //     label: 'Export',
  //   },
  //   {
  //     key: '3',
  //     label: 'Delete',
  //     danger: true,
  //   },
  // ];

  const columns: TableColumnsType<Processes[number]> = [
    {
      title: 'Process Name',
      dataIndex: 'definitionName',
      className: styles.Title,
      sorter: (a, b) => a.definitionName.localeCompare(b.definitionName),
    },
    // {
    //   title: 'Description',
    //   dataIndex: 'description',
    //   sorter: (a, b) => a.description.localeCompare(b.description),
    // },
    // {
    //   title: 'Owner',
    //   dataIndex: 'owner',
    // },
    // {
    //   title: 'Created',
    //   dataIndex: 'createdOn',
    //   render: (date: Date) => date.toLocaleString(),
    //   sorter: (a, b) => b.createdOn.getTime() - a.createdOn.getTime(),
    // },

    {
      title: 'Last Edited',
      dataIndex: 'lastEdited',
      render: (date: Date) => date.toLocaleString(),
      sorter: (a, b) => b.lastEdited.getTime() - a.lastEdited.getTime(),
    },
    {
      title: 'Departments',
      dataIndex: 'departments',
      render: (dep) => dep.join(', '),
      sorter: (a, b) => a.definitionName.localeCompare(b.definitionName),
    },
    {
      title: 'File Size',
      // dataIndex: 'departments',
      // render: (dep) => dep.join(', '),
      sorter: (a, b) => (a < b ? -1 : 1),
    },
    /*{
      title: 'Actions',
      fixed: 'right',
      width: 100,
      className: styles.ActionCell,
      render: () => (
        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown menu={{ items: processActions }} arrow>
            <EllipsisOutlined rotate={90} className={styles.Action} />
          </Dropdown>
        </div>
      ),
    },*/
    {
      fixed: 'right',
      // add title but only if at least one row is selected

      title: selection.length ? actionBar : '',
      render: () => actionBar,
    },
  ];

  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['processes'],
    queryFn: () => fetchProcesses(),
  });

  if (isError) {
    return <div>Error</div>;
  }

  return (
    <>
      <Table
        rowSelection={{
          type: 'checkbox',
          ...rowSelection,
        }}
        onRow={(record, rowIndex) => ({
          onClick: () => {
            // TODO: This is a hack to clear the parallel route when selecting
            // another process. (needs upstream fix)
            router.refresh();
            router.push(`/processes/${record.definitionId}`);
          },
          onMouseEnter: (event) => {
            console.log('mouse enter row', event);
          }, // mouse enter row
          onMouseLeave: (event) => {
            console.log('mouse leave row', event);
          }, // mouse leave row
        })}
        sticky
        scroll={{ x: 1300 }}
        rowClassName={styles.Row}
        rowKey="definitionId"
        columns={columns}
        dataSource={data as any}
        loading={isLoading}
        className={styles.Table}
      />
    </>
  );
};

export default Processes;
