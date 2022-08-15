export type MenuItem = {
  title: string;
  enabled?: boolean;
  checked?: boolean;
  callback?: () => void;
  submenu?: MenuItem[];
};