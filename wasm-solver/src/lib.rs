use wasm_bindgen::prelude::*;

/// Preconditioned Conjugate Gradient solver for sparse linear systems
/// 
/// Solves A*x = b where A is a symmetric positive definite sparse matrix
/// stored in CSR (Compressed Sparse Row) format.
/// 
/// Uses Jacobi (diagonal) preconditioner for improved convergence.

/// Result struct containing solution and metadata
#[wasm_bindgen]
pub struct SolveResult {
    solution: Vec<f64>,
    iterations: u32,
    residual: f64,
}

#[wasm_bindgen]
impl SolveResult {
    #[wasm_bindgen(getter)]
    pub fn solution(&self) -> Vec<f64> {
        self.solution.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn iterations(&self) -> u32 {
        self.iterations
    }

    #[wasm_bindgen(getter)]
    pub fn residual(&self) -> f64 {
        self.residual
    }
}

/// Compute dot product of two vectors
#[inline]
fn dot(a: &[f64], b: &[f64]) -> f64 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

/// Compute vector L2 norm
#[inline]
fn norm(v: &[f64]) -> f64 {
    dot(v, v).sqrt()
}

/// Sparse matrix-vector multiplication: y = A * x
/// A is in CSR format
#[inline]
fn spmv(values: &[f64], col_indices: &[u32], row_ptr: &[u32], x: &[f64], y: &mut [f64]) {
    let n = y.len();
    for i in 0..n {
        let row_start = row_ptr[i] as usize;
        let row_end = row_ptr[i + 1] as usize;
        let mut sum = 0.0;
        for j in row_start..row_end {
            sum += values[j] * x[col_indices[j] as usize];
        }
        y[i] = sum;
    }
}

/// Extract diagonal elements from CSR matrix (for Jacobi preconditioner)
fn extract_diagonal(values: &[f64], col_indices: &[u32], row_ptr: &[u32], n: usize) -> Vec<f64> {
    let mut diag = vec![1.0; n];
    for i in 0..n {
        let row_start = row_ptr[i] as usize;
        let row_end = row_ptr[i + 1] as usize;
        for j in row_start..row_end {
            if col_indices[j] as usize == i {
                let val = values[j];
                diag[i] = if val.abs() > 1e-30 { val } else { 1.0 };
                break;
            }
        }
    }
    diag
}

/// Apply Jacobi preconditioner: z = M^{-1} * r
/// where M = diag(A)
#[inline]
fn apply_jacobi(diag: &[f64], r: &[f64], z: &mut [f64]) {
    for i in 0..r.len() {
        z[i] = r[i] / diag[i];
    }
}

/// Preconditioned Conjugate Gradient solver
/// 
/// # Arguments
/// * `values` - Non-zero values of the sparse matrix (CSR format)
/// * `col_indices` - Column indices for each value
/// * `row_ptr` - Row pointers (index into values for each row start)
/// * `b` - Right-hand side vector
/// * `x0` - Initial guess
/// * `tol` - Convergence tolerance
/// * `max_iter` - Maximum number of iterations
/// 
/// # Returns
/// SolveResult containing the solution vector, iteration count, and final residual
#[wasm_bindgen]
pub fn solve_pcg(
    values: &[f64],
    col_indices: &[u32],
    row_ptr: &[u32],
    b: &[f64],
    x0: &[f64],
    tol: f64,
    max_iter: u32,
) -> SolveResult {
    let n = b.len();
    
    // Solution vector (start from initial guess)
    let mut x: Vec<f64> = x0.to_vec();
    
    // Work vectors
    let mut r = vec![0.0; n];   // Residual
    let mut z = vec![0.0; n];   // Preconditioned residual
    let mut p = vec![0.0; n];   // Search direction
    let mut ap = vec![0.0; n];  // A * p
    
    // Extract diagonal for Jacobi preconditioner
    let diag = extract_diagonal(values, col_indices, row_ptr, n);
    
    // Compute initial residual: r = b - A*x
    spmv(values, col_indices, row_ptr, &x, &mut r);
    for i in 0..n {
        r[i] = b[i] - r[i];
    }
    
    // Compute convergence threshold
    let bnorm = norm(b);
    let threshold = tol * bnorm.max(1.0);
    
    let mut rnorm = norm(&r);
    if rnorm < threshold {
        return SolveResult {
            solution: x,
            iterations: 0,
            residual: rnorm,
        };
    }
    
    // z = M^{-1} * r
    apply_jacobi(&diag, &r, &mut z);
    
    // p = z
    p.copy_from_slice(&z);
    
    // rz = r^T * z
    let mut rz = dot(&r, &z);
    
    let mut iter = 0u32;
    for i in 0..max_iter {
        iter = i + 1;
        
        // ap = A * p
        spmv(values, col_indices, row_ptr, &p, &mut ap);
        
        // alpha = rz / (p^T * A*p)
        let pap = dot(&p, &ap);
        if pap.abs() < 1e-30 {
            // Matrix might be singular or near-singular
            break;
        }
        let alpha = rz / pap;
        
        // x = x + alpha * p
        for j in 0..n {
            x[j] += alpha * p[j];
        }
        
        // r = r - alpha * A*p
        for j in 0..n {
            r[j] -= alpha * ap[j];
        }
        
        // Check convergence
        rnorm = norm(&r);
        if rnorm < threshold {
            break;
        }
        
        // z = M^{-1} * r
        apply_jacobi(&diag, &r, &mut z);
        
        // beta = (r_new^T * z_new) / (r_old^T * z_old)
        let rz_new = dot(&r, &z);
        let beta = rz_new / rz;
        rz = rz_new;
        
        // p = z + beta * p
        for j in 0..n {
            p[j] = z[j] + beta * p[j];
        }
    }
    
    SolveResult {
        solution: x,
        iterations: iter,
        residual: rnorm,
    }
}

/// Simple test function to verify WASM is working
#[wasm_bindgen]
pub fn wasm_test() -> f64 {
    // Solve a simple 2x2 system: [4, 1; 1, 3] * x = [1; 2]
    // Solution should be approximately [0.0909, 0.6364]
    let values = vec![4.0, 1.0, 1.0, 3.0];
    let col_indices = vec![0u32, 1, 0, 1];
    let row_ptr = vec![0u32, 2, 4];
    let b = vec![1.0, 2.0];
    let x0 = vec![0.0, 0.0];
    
    let result = solve_pcg(&values, &col_indices, &row_ptr, &b, &x0, 1e-10, 100);
    
    // Return sum of solution (should be ~0.727)
    result.solution.iter().sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_2x2() {
        // [4, 1; 1, 3] * x = [1; 2]
        // Solution: x = [1/11, 7/11] ≈ [0.0909, 0.6364]
        let values = vec![4.0, 1.0, 1.0, 3.0];
        let col_indices = vec![0u32, 1, 0, 1];
        let row_ptr = vec![0u32, 2, 4];
        let b = vec![1.0, 2.0];
        let x0 = vec![0.0, 0.0];
        
        let result = solve_pcg(&values, &col_indices, &row_ptr, &b, &x0, 1e-10, 100);
        
        assert!((result.solution[0] - 1.0/11.0).abs() < 1e-8);
        assert!((result.solution[1] - 7.0/11.0).abs() < 1e-8);
    }

    #[test]
    fn test_3x3_identity() {
        // Identity matrix: I * x = b, solution is x = b
        let values = vec![1.0, 1.0, 1.0];
        let col_indices = vec![0u32, 1, 2];
        let row_ptr = vec![0u32, 1, 2, 3];
        let b = vec![1.0, 2.0, 3.0];
        let x0 = vec![0.0, 0.0, 0.0];
        
        let result = solve_pcg(&values, &col_indices, &row_ptr, &b, &x0, 1e-10, 100);
        
        for i in 0..3 {
            assert!((result.solution[i] - b[i]).abs() < 1e-10);
        }
    }

    #[test]
    fn test_3x3_symmetric() {
        // [4, 1, 1; 1, 4, 1; 1, 1, 4] * x = [6; 6; 6]
        // Solution: x = [1, 1, 1]
        let values = vec![4.0, 1.0, 1.0, 1.0, 4.0, 1.0, 1.0, 1.0, 4.0];
        let col_indices = vec![0u32, 1, 2, 0, 1, 2, 0, 1, 2];
        let row_ptr = vec![0u32, 3, 6, 9];
        let b = vec![6.0, 6.0, 6.0];
        let x0 = vec![0.0, 0.0, 0.0];
        
        let result = solve_pcg(&values, &col_indices, &row_ptr, &b, &x0, 1e-10, 100);
        
        for i in 0..3 {
            assert!((result.solution[i] - 1.0).abs() < 1e-8);
        }
    }
}
