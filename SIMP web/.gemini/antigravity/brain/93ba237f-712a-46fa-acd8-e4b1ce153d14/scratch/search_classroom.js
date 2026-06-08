const fs = require('fs');
const filePath = 'c:\\Users\\Ryan Fajardo\\OneDrive\\Desktop\\final simp\\SIMP web\\enroll\\classroom.html';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('renderCourseCards') && line.includes('function')) {
        console.log(`\nLine ${index + 1}: ${line.trim()}`);
        for (let i = index; i < Math.min(lines.length, index + 80); i++) {
            console.log(`[L${i+1}] ${lines[i]}`);
        }
    }
});
