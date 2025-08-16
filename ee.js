(function() {
    console.log('🚀 Bắt đầu tự động điền form khảo sát...');

    function getRandomAnswer() {
        return Math.floor(Math.random() * 5) + 1;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function autoFillForm() {
        try {

            const radioGroups = document.querySelectorAll('[role="radiogroup"]');
            console.log(`✅ Tìm thấy ${radioGroups.length} câu hỏi`);

            for (let i = 0; i < radioGroups.length; i++) {
                const group = radioGroups[i];

                const questionElement = group.closest('.geS5n').querySelector('[role="heading"]');
                const questionText = questionElement ? questionElement.textContent.trim() : '';

                console.log(`📝 Đang xử lý câu ${i + 1}: ${questionText.substring(0, 50)}...`);

                let answerValue;
                if (questionText.includes("Hãy chọn vào ô") && questionText.includes("Hoàn toàn không đồng ý")) {
                    answerValue = 1; 
                    console.log(`🎯 Câu kiểm tra phát hiện - chọn đáp án ${answerValue}`);
                } else {
                    answerValue = getRandomAnswer(); 
                    console.log(`🎲 Chọn ngẫu nhiên đáp án ${answerValue}`);
                }

                const radioButton = group.querySelector(`[data-value="${answerValue}"]`);

                if (radioButton) {

                    radioButton.click();
                    console.log(`✅ Đã chọn đáp án ${answerValue} cho câu ${i + 1}`);

                    await sleep(100);
                } else {
                    console.warn(`⚠️ Không tìm thấy radio button cho giá trị ${answerValue} ở câu ${i + 1}`);
                }
            }

            console.log('🎉 Hoàn thành việc điền tất cả câu hỏi!');
            console.log('💡 Bạn có thể nhấn nút "Tiếp" để chuyển trang tiếp theo!');

        } catch (error) {
            console.error('❌ Lỗi khi điền form:', error);
        }
    }

    autoFillForm();

})();
