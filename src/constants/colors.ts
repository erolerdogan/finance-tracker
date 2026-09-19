export const CATEGORY_COLORS: Record<string, string> = {
    Housing: '#007AFF',
    Childcare: '#AF52DE',
    Groceries: '#34C759',
    'Dining Out': '#FF9500',
    Transportation: '#5856D6',
    'Utilities & Telecom': '#5AC8FA',
    'Health & Care': '#FF2D55',
    'Shopping & Retail': '#FFCC00',
    'Taxes & Municipal Fees': '#FF3B30',
  };
  
  export function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || '#8E8E93';
  }