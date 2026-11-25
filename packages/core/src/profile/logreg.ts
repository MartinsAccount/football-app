// L2-regularizált (bináris) logisztikus regresszió Newton/IRLS-lépésekkel. Determinisztikus (kezdés: 0 vektor), kis dimenzióra.
//   min  −Σ w_i [y_i log σ(x_i·β) + (1−y_i) log(1−σ(x_i·β))]  +  λ/2 · Σ_j m_j β_j²   (m_j: büntetés-maszk, 0 vagy 1)

export interface LogRegOptions {
	/** L2 erősség (λ). Alapból 1. */
	lambda?: number;
	/** Oszloponként: büntetjük-e (alapból mind). */
	penalize?: readonly boolean[];
	maxIter?: number;
	tol?: number;
}

export interface LogRegFit {
	weights: number[];
	iterations: number;
	converged: boolean;
}

const RIDGE_FLOOR = 1e-8;

export const sigmoid = (t: number): number => (t >= 0 ? 1 / (1 + Math.exp(-t)) : Math.exp(t) / (1 + Math.exp(t)));

export const dot = (a: readonly number[], b: readonly number[]): number => {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
};

/** Ax = b megoldása részleges főelem-kiválasztásos Gauss-eliminációval (A szimmetrikus pozitív definit itt). */
const solve = (A: number[][], b: number[]): number[] => {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let piv = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
		[M[c], M[piv]] = [M[piv], M[c]];
		const d = M[c][c];
		if (Math.abs(d) < 1e-14) throw new Error('Szinguláris Hesse-mátrix.');
		for (let r = c + 1; r < n; r++) {
			const f = M[r][c] / d;
			if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
		}
	}
	const x = new Array<number>(n).fill(0);
	for (let r = n - 1; r >= 0; r--) {
		let s = M[r][n];
		for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
		x[r] = s / M[r][r];
	}
	return x;
};

export const fitLogisticRegression = (
	X: readonly (readonly number[])[],
	y: readonly number[],
	opts: LogRegOptions = {},
	sampleWeights?: readonly number[]
): LogRegFit => {
	if (X.length === 0) throw new Error('Üres tanítóhalmaz.');
	if (X.length !== y.length) throw new Error('X és y hossza eltér.');
	const d = X[0].length;
	const lambda = opts.lambda ?? 1;
	const pen = Array.from({ length: d }, (_, j) => (opts.penalize?.[j] ?? true ? lambda : 0) + RIDGE_FLOOR);
	const maxIter = opts.maxIter ?? 50;
	const tol = opts.tol ?? 1e-9;
	let beta = new Array<number>(d).fill(0);
	for (let it = 1; it <= maxIter; it++) {
		const grad = beta.map((b, j) => pen[j] * b);
		const H = Array.from({ length: d }, (_, j) => Array.from({ length: d }, (_, k) => (j === k ? pen[j] : 0)));
		for (let i = 0; i < X.length; i++) {
			const x = X[i];
			const w = sampleWeights?.[i] ?? 1;
			const p = sigmoid(dot(x, beta));
			const r = w * (p - y[i]);
			const s = w * p * (1 - p);
			for (let j = 0; j < d; j++) {
				if (x[j] === 0) continue;
				grad[j] += r * x[j];
				for (let k = 0; k < d; k++) H[j][k] += s * x[j] * x[k];
			}
		}
		const step = solve(H, grad);
		beta = beta.map((b, j) => b - step[j]);
		if (Math.max(...step.map(Math.abs)) < tol) return { weights: beta, iterations: it, converged: true };
	}
	return { weights: beta, iterations: maxIter, converged: false };
};
