export interface UpdateNote {
    version: string;
    date: string;
    title: string;
    changes: {
        type: 'feature' | 'fix' | 'balance' | 'system';
        text: string;
    }[];
}

export const UPDATE_NOTES: UpdateNote[] = [
    {
        version: 'v0.9.5',
        date: '2026-03-04',
        title: '地圖視覺與探索最佳化',
        changes: [
            { type: 'feature', text: '新增「地圖樣式」選單，提供多種高質感底圖可選' },
            { type: 'feature', text: '實裝「自動變化」地圖系統，底圖隨天氣動態切換' },
            { type: 'fix', text: '修復技能突破失敗時，技能碎片異常回復之漏洞（同步機制優化）' },
            { type: 'balance', text: '神明介面大幅優化：數值加成透明化，並大幅調降升級所需香火（每級遞增200）' },
            { type: 'balance', text: '神廟招募機率提升至 10%！' },
            { type: 'fix', text: '戰鬥消耗品（如藥水）修復屬性遺失問題，數量運算更精準' },
            { type: 'system', text: '「自動探索」狀態支援跨網頁整理、重開持久化記憶' }
        ]
    }
];
