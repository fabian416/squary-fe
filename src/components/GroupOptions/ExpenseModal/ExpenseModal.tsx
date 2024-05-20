import React, { useState } from 'react';
import Modal from 'react-modal';
import styles from './ExpenseModal.module.css';

interface ExpenseModalProps {
  show: boolean;
  handleClose: () => void;
  addExpense: (amount: number, description: string, sharedWith: string[]) => void;
  groupMembers: string[];
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ show, handleClose, addExpense, groupMembers = [] }) => {
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  const handleAddExpense = () => {
    addExpense(amount, description, sharedWith);
    handleClose();
  };

  const handleSharedWithChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    setSharedWith(selectedOptions);
  };

  return (
    <Modal
      isOpen={show}
      onRequestClose={handleClose}
      className={styles.modal}
      overlayClassName={styles.overlay}
    >
      <h2>Add Expense</h2>
      <form>
        <div className={styles.formGroup}>
          <label>Amount</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(Number(e.target.value))} 
          />
        </div>
        <div className={styles.formGroup}>
          <label>Description</label>
          <input 
            type="text" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
          />
        </div>
        <div className={styles.formGroup}>
          <label>Shared With</label>
          <select 
            multiple 
            value={sharedWith} 
            onChange={handleSharedWithChange}
          >
            {groupMembers.map(member => (
              <option key={member} value={member}>{member}</option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <button 
            type="button" 
            onClick={handleAddExpense}
          >
            Add
          </button>
          <button 
            type="button" 
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ExpenseModal;