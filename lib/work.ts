export type WorkItem = {
  id: string;
  title: string;
  status: 'In Progress' | 'Review' | 'Done';
  priority: 'Low' | 'Medium' | 'High';
  due: string;
  progress: number;
  assignedTo: string;
  subtasks: string[];
};
