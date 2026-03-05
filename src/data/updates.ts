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
        version: 'v0.9.7',
        date: '2026-03-05',
        title: '菁英機制優化與商城介面改版',
        changes: [
            { type: 'feature', text: '推出星空加值商城：提升遊戲體驗最佳法寶。' },
            { type: 'fix', text: '修復菁英怪恢復邏輯：擊敗菁英/首領怪物現在能正確觸發 30% HP/MP 恢復。' },
            { type: 'fix', text: '修正遇敵怪池限制：開放全等級怪池以利完成任務。' },
            { type: 'system', text: '新增維護模式：當維護模式啟動時自動停止遊戲直到重新開放(維護後會自動刷新網頁)' },
            { type: 'system', text: '任務同步強化：實裝史萊姆、哥布林、骷髏兵等特定怪物的擊殺計數與採集任務自動同步。' },
            { type: 'balance', text: '數值平衡調整：調整夥伴經驗加成道具，維持長線遊戲平衡。' },
            { type: 'system', text: '資料庫寫入安全優化：實施行級鎖定確保數據安全。' }
        ]
    },
    {
        version: 'v0.9.6',
        date: '2026-03-04',
        title: '戰鬥數值對齊與任務介面優化',
        changes: [
            { type: 'fix', text: '修復藥水治療限制問題，現在可正確補滿 HP。' },
            { type: 'fix', text: '同步戰鬥獎勵顯示，確保日誌與獲取 EXP/金幣完全一致。' },
            { type: 'feature', text: '任務頁面 UI 優化：加大文字字級、調整佈局寬度。' },
            { type: 'system', text: '重構全域屬性計算邏輯（ATK/DEF/HP），提升結算精確度。' }
        ]
    },
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
