const familyNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
    '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '池田', '橋本', '阿部', '森', '石川'];
const givenNames = ['葵', '陽菜', '蓮', '大翔', '美咲', '結衣', '陽翔', '優斗', '美月', '蒼', 'まどか', '凛',
    '美穂', '悠真', '直樹', '遥', '和也', '恵', '翔太', '楓', '陸', '海斗', '沙織', '紗季', '健太'];

/**
 * 固定の連番から架空の顧客名を選んで毎回同じ組み合わせを作る
 */
export function sampleCustomerName(index: number) {
    return {
        lastName: familyNames[index % familyNames.length],
        firstName: givenNames[Math.floor(index / familyNames.length) % givenNames.length]
    };
}
