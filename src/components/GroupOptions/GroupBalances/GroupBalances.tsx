import React, { useEffect, useState } from 'react';
import { firestore } from '../../../firebaseConfig';
import { collection, Timestamp, setDoc, getDocs, doc } from 'firebase/firestore';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import styles from './GroupBalances.module.css';

// Apollo Client setup
const client = new ApolloClient({
  uri: 'https://api.studio.thegraph.com/query/49377/balances/v0.0.1',
  cache: new InMemoryCache(),
});

const GET_BALANCES = gql`
  query GetBalances($groupId: Bytes!) {
    balances(where: { groupId: $groupId }) {
      id
      groupId
      member
      balance
    }
  }
`;

interface GroupBalancesProps {
  groupId: string;
}

interface Debt {
  debtor: string;
  creditor: string;
  amount: number;
}

interface Expense {
  amount: number;
  description: string;
  paidBy: string;
  sharedWith: string[];
  settled: boolean;
  timestamp: Timestamp;
}

interface Balance {
  id: string;
  groupId: string;
  member: string;
  balance: number;
}

const GroupBalances: React.FC<GroupBalancesProps> = ({ groupId }) => {
  const [debts, setDebts] = useState<Debt[]>([]);

  useEffect(() => {
    const fetchExpensesAndSimplifyDebts = async () => {
      const expensesRef = collection(firestore, 'groups', groupId, 'expenses');
      const snapshot = await getDocs(expensesRef);
      const balances: { [key: string]: number } = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const expense: Expense = {
          amount: data.amount,
          description: data.description,
          paidBy: data.paidBy,
          sharedWith: data.sharedWith,
          settled: data.settled,
          timestamp: data.timestamp
        };

        if (!expense.settled) {
          const totalParticipants = expense.sharedWith.length + 1; // Incluye al pagador
          const share = expense.amount / totalParticipants;

          // Ajustar la deuda de los miembros compartidos
          expense.sharedWith.forEach((member: string) => {
            if (!balances[member]) {
              balances[member] = 0;
            }
            balances[member] -= share; // Cada miembro debe una parte del gasto
          });

          // Ajustar la deuda del pagador
          if (!balances[expense.paidBy]) {
            balances[expense.paidBy] = 0;
          }
          balances[expense.paidBy] += share * expense.sharedWith.length; // El pagador asume la parte restante
        }
      });

      // Lógica para simplificar las deudas off-chain
      const calculatedDebts: Debt[] = [];
      for (const [debtor, debt] of Object.entries(balances)) {
        if (debt < 0) {
          for (const [creditor, credit] of Object.entries(balances)) {
            if (credit > 0) {
              const amount = Math.min(-debt, credit);
              if (amount > 0) {
                calculatedDebts.push({ debtor, creditor, amount });
                balances[debtor] += amount;
                balances[creditor] -= amount;
              }
            }
          }
        }
      }

      setDebts(prevDebts => [...prevDebts, ...calculatedDebts]);

      // Almacenar las deudas simplificadas en Firestore
      await setDoc(doc(firestore, 'groups', groupId), { debts: calculatedDebts }, { merge: true });
    };

    const fetchOnChainBalances = async () => {
      const result = await client.query({
        query: GET_BALANCES,
        variables: { groupId },
      });

      const onChainBalances = result.data.balances;

      // Lógica para simplificar las deudas on-chain
      const onChainDebts: { [key: string]: number } = {};
      onChainBalances.forEach((balance: Balance) => {
        if (!onChainDebts[balance.member]) {
          onChainDebts[balance.member] = 0;
        }
        onChainDebts[balance.member] += balance.balance;
      });

      // Convertir el objeto de balances en un array de deudas
      const calculatedOnChainDebts: Debt[] = [];
      for (const [debtor, debt] of Object.entries(onChainDebts)) {
        if (debt < 0) {
          for (const [creditor, credit] of Object.entries(onChainDebts)) {
            if (credit > 0) {
              const amount = Math.min(-debt, credit);
              if (amount > 0) {
                calculatedOnChainDebts.push({ debtor, creditor, amount });
                onChainDebts[debtor] += amount;
                onChainDebts[creditor] -= amount;
              }
            }
          }
        }
      }

      setDebts(prevDebts => [...prevDebts, ...calculatedOnChainDebts]);
    };

    fetchExpensesAndSimplifyDebts();
    fetchOnChainBalances();
  }, [groupId]);

  return (
    <div className={styles.container}>
      <div className={styles.groupContainer}>
        <h2 className={styles.subTitle}>Simplified Debts</h2>
        <ul className={styles.debtsList}>
          {debts.map((debt, index) => (
            <li key={index} className={styles.debtCard}>
              <span className={styles.debtor}>{debt.debtor}</span> owes <span className={styles.creditor}>{debt.creditor}</span>: 
              <span className={styles.amount}>${Number(debt.amount).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default GroupBalances;
