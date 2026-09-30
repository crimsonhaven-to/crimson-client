import { listLabel } from './watchlists';
import ConfirmDialog from './ConfirmDialog';

const DeleteListDialog = ({ name, onCancel, onConfirm }) => (
  <ConfirmDialog title="Delete this list?" confirmLabel="Delete List" onCancel={onCancel} onConfirm={onConfirm}>
    The <span className="font-black text-crimson-100">"{listLabel(name)}"</span> list will be removed and its shows unbound from it. The shows themselves stay in any other lists. This cannot be undone.
  </ConfirmDialog>
);

export default DeleteListDialog;
