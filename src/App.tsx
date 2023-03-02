import React from 'react';
import Box from '@mui/material/Box';
import FileUploader from './components/FileUploader';
import './App.css';

function App() {
  return (
    <div className="App center">
      <Box 
        component="span"
        className='center' 
        sx={{
          p: 1,  
          border: '1px dashed grey',
          height: '80px',
          width: '100%',
          maxWidth: '800px',
        }}>
          <FileUploader></FileUploader>
      </Box> 
    </div>
  );
}

export default App;
