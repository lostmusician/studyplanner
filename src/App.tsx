import { useState } from 'react';
import { useStudyPlan } from './hooks/useStudyPlan';
import { StudyPlan } from './components/StudyPlan';

const App = () => {
  const plan = useStudyPlan();
  const [studentName, setStudentName] = useState('Student Name');
  const [matricNo, setMatricNo] = useState('A0000000X');

  if (!plan.major) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas text-ink">
        No majors configured.
      </div>
    );
  }

  return (
    <StudyPlan
      {...plan}
      studentName={studentName}
      setStudentName={setStudentName}
      matricNo={matricNo}
      setMatricNo={setMatricNo}
    />
  );
};

export default App;
